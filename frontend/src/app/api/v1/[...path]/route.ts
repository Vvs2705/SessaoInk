import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "https://sessaoink-api.fly.dev";
const PRODUCTION = process.env.NODE_ENV === "production";
const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://sessao-ink.vercel.app";

/** Métodos que modificam estado — verificamos Origin nesses casos. */
const CSRF_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Caminhos isentos de verificação de CSRF (endpoints públicos sem sessão). */
const CSRF_EXEMPT = [
  "/api/v1/public/",
  "/api/v1/auth/login",
];

async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const qs = request.nextUrl.searchParams.toString();
  // Next.js may strip trailing slash from pathname; force it back for
  // single-segment paths (collection endpoints) so FastAPI doesn't redirect.
  const rawPathname = request.nextUrl.pathname;
  const pathStr = path.join("/");
  const needsSlash = rawPathname.endsWith("/") || path.length === 1;
  const url = `${BACKEND}/api/v1/${pathStr}${needsSlash ? "/" : ""}${qs ? `?${qs}` : ""}`;

  // ── CSRF: verificar Origin em requisições mutáveis ──────────────────────
  // Em produção, requests de origem diferente de APP_ORIGIN são bloqueados
  // antes mesmo de chegar ao backend. Browser SEMPRE define Origin em
  // requisições cross-origin — se estiver ausente é uma requisição same-origin
  // (do próprio frontend) e pode passar.
  if (PRODUCTION && CSRF_METHODS.has(request.method)) {
    const isExempt = CSRF_EXEMPT.some((p) => rawPathname.startsWith(p));
    if (!isExempt) {
      const origin = request.headers.get("origin");
      if (origin && origin !== APP_ORIGIN) {
        console.warn(`[CSRF] Bloqueado: origin=${origin} method=${request.method} path=${rawPathname}`);
        return NextResponse.json({ detail: "Origem não autorizada" }, { status: 403 });
      }
    }
  }
  // ────────────────────────────────────────────────────────────────────────

  const accessToken = request.cookies.get("access_token")?.value;
  const csrfToken = request.cookies.get("csrf_token")?.value;
  // refresh_token tem Path=/api/v1/auth/refresh — o browser só o envia nessa rota,
  // e o backend precisa dele para renovar a sessão. Sem este repasse, todo refresh
  // responde 401 "Refresh token não encontrado".
  const refreshToken = request.cookies.get("refresh_token")?.value;
  const incomingContentType = request.headers.get("content-type") ?? "";
  const isMultipart =
    incomingContentType.includes("multipart/form-data") ||
    incomingContentType.includes("application/x-www-form-urlencoded");

  const headers = new Headers();
  const cookieHeader = [
    accessToken ? `access_token=${accessToken}` : "",
    csrfToken ? `csrf_token=${csrfToken}` : "",
    refreshToken ? `refresh_token=${refreshToken}` : "",
  ]
    .filter(Boolean)
    .join("; ");
  if (cookieHeader) headers.set("Cookie", cookieHeader);

  const incomingCsrf = request.headers.get("x-csrf-token");
  if (incomingCsrf) headers.set("X-CSRF-Token", incomingCsrf);

  // Encaminhar o Origin real do browser para o backend como header customizado.
  // O backend usa X-Origin-Browser para validação CSRF em profundidade
  // (defesa em camadas — o proxy já rejeitou a maioria, mas o backend valida também).
  const browserOrigin = request.headers.get("origin");
  if (browserOrigin) {
    headers.set("X-Origin-Browser", browserOrigin);
  } else {
    // Requisição same-origin: informamos explicitamente ao backend
    headers.set("X-Origin-Browser", APP_ORIGIN);
  }

  // Encaminhar o IP real do browser (rate limit e auditoria por IP no backend).
  const clientIp =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip");
  if (clientIp) headers.set("X-Forwarded-For", clientIp);

  // P0-03 — segredo proxy↔backend: prova que o X-Forwarded-For acima veio do
  // nosso proxy (e não de um atacante falando direto com a Fly). O backend só
  // confia no XFF quando este header bate com INTERNAL_PROXY_SECRET. Inerte
  // enquanto a env var não estiver definida na Vercel.
  const proxySecret = process.env.INTERNAL_PROXY_SECRET;
  if (proxySecret) headers.set("X-Internal-Proxy-Secret", proxySecret);

  // Correlation ID — rastreabilidade ponta a ponta (P1-05). Reaproveita o id do
  // browser se houver, senão gera um. O backend ecoa em X-Correlation-ID.
  const correlationId =
    request.headers.get("x-correlation-id") ?? crypto.randomUUID();
  headers.set("X-Correlation-ID", correlationId);

  const hasBody = !["GET", "HEAD", "DELETE"].includes(request.method);

  let body: ArrayBuffer | string | undefined;
  if (hasBody) {
    if (isMultipart) {
      headers.set("Content-Type", incomingContentType);
      body = await request.arrayBuffer();
    } else {
      headers.set("Content-Type", "application/json");
      body = await request.text();
    }
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(url, {
      method: request.method,
      headers,
      body,
    });
  } catch {
    return NextResponse.json({ detail: "Erro de conexão com o servidor" }, { status: 503 });
  }

  // Set-Cookie do backend (ex.: rotação de access/refresh no /auth/refresh) precisa
  // chegar ao browser — sem isso a sessão renovada nunca é gravada e o token antigo,
  // já invalidado no Redis, derruba o usuário. getSetCookie() pela mesma razão do
  // proxy de login (spec exclui set-cookie do headers.get()).
  const setCookies =
    typeof backendRes.headers.getSetCookie === "function"
      ? backendRes.headers.getSetCookie()
      : (backendRes.headers.get("set-cookie") ?? "")
          .split(/,(?=\s*\w+=)/)
          .filter(Boolean);

  // Status sem corpo (204/205/304): a spec do Fetch PROÍBE corpo — passar um
  // ArrayBuffer (mesmo vazio) faz o construtor de Response lançar e o proxy
  // retornar 500. Endpoints como DELETE (arquivar) e logout retornam 204.
  const NULL_BODY_STATUS = backendRes.status === 204 || backendRes.status === 205 || backendRes.status === 304;
  if (NULL_BODY_STATUS) {
    const empty = new NextResponse(null, { status: backendRes.status });
    setCookies.forEach((c) => empty.headers.append("set-cookie", c.trim()));
    return empty;
  }

  const contentType = backendRes.headers.get("content-type") ?? "application/json";
  const resBody = await backendRes.arrayBuffer();

  const response = new NextResponse(resBody, {
    status: backendRes.status,
    headers: { "Content-Type": contentType },
  });
  setCookies.forEach((c) => response.headers.append("set-cookie", c.trim()));
  return response;
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as PUT, proxy as DELETE };
