import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "https://sessaoink-api.fly.dev";

export async function POST(request: NextRequest) {
  const body = await request.text();

  // Encaminhar o IP real do browser para o backend (rate limit de login por IP).
  // A Vercel define x-forwarded-for/x-real-ip na borda; sem repassar, o backend
  // veria apenas o IP do servidor Vercel e todos os logins dividiriam o bucket.
  const clientIp =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "";

  const fwdHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (clientIp) fwdHeaders["X-Forwarded-For"] = clientIp;

  // P0-03 — prova de origem do proxy: sem este segredo o backend ignora o
  // X-Forwarded-For acima (anti-spoofing do rate-limit de login). Inerte
  // enquanto INTERNAL_PROXY_SECRET não estiver definido na Vercel.
  const proxySecret = process.env.INTERNAL_PROXY_SECRET;
  if (proxySecret) fwdHeaders["X-Internal-Proxy-Secret"] = proxySecret;

  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND}/api/v1/auth/login`, {
      method: "POST",
      headers: fwdHeaders,
      body,
    });
  } catch {
    return NextResponse.json(
      { detail: "Erro de conexão com o servidor" },
      { status: 503 }
    );
  }

  const data = await backendRes.json();
  const response = NextResponse.json(data, { status: backendRes.status });

  if (backendRes.ok) {
    // Encaminhar os cookies do FastAPI — sem atributo Domain, o browser os armazena
    // para o domínio Vercel, tornando-os visíveis ao middleware Next.js.
    const raw = backendRes.headers.get("set-cookie");
    if (raw) {
      // Pode haver múltiplos cookies separados por vírgula (ex: access + refresh)
      raw.split(/,(?=\s*\w+=)/).forEach((c) =>
        response.headers.append("set-cookie", c.trim())
      );
    }

    // Marcador de sessão não-secreto (Path=/, 7 dias): permite ao middleware saber
    // que há sessão ativa mesmo após o access_token (15 min) expirar, evitando
    // logout ao recarregar/deep-link. O client renova o access_token via /auth/refresh.
    response.cookies.set("sk_session", "1", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  return response;
}
