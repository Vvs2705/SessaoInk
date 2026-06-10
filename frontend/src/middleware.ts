import { NextRequest, NextResponse } from "next/server";

// =====================================================================
// P0-01 — Middleware deny-by-default (sem mudar URLs)
// Estratégia: só são públicas as formas EXPLICITAMENTE reconhecidas
// (auth, marketing, portal por slug, estáticos). Tudo o mais exige login.
// =====================================================================

// Rotas internas (grupo (dashboard)) — exigem access_token. Cobrem o segmento
// raiz e seus subcaminhos (ex.: /clientes e /clientes/{id}).
// IMPORTANTE: ao criar uma nova página interna de segmento único, ADICIONE-A aqui
// — caso contrário ela cairia na faixa de "slug público".
const INTERNAL_ROUTES = new Set([
  "agenda",
  "atendimentos",
  "clientes",
  "configuracoes",
  "documentos",
  "estoque",
  "financeiro",
  "flash-arts",
  "mais",
  "portfolio",
  "relatorios",
  // Reservados (futuros) — defensivo:
  "usuarios",
  "assinatura",
  "billing",
  "admin",
]);

// Páginas públicas exatas (sem sessão).
const PUBLIC_EXACT = new Set([
  "/login",
  "/cadastro",
  "/esqueci-senha",
  "/resetar-senha",
  "/registro", // aliases defensivos
  "/senha",
  "/precos", // marketing pública
]);

// Páginas de autenticação — usuário JÁ logado é mandado ao dashboard.
const AUTH_ROUTES = new Set([
  "/login",
  "/cadastro",
  "/esqueci-senha",
  "/resetar-senha",
  "/registro",
  "/senha",
]);

// Segundo segmento válido do portal público /{slug}/...
const PORTAL_SUBROUTES = new Set([
  "orcamento",
  "portfolio",
  "flash-arts",
  "documento",
]);

const DASHBOARD_ROOT = "/";

/** Uma rota é portal público se for /{slug} (um segmento, não interno) ou
 *  /{slug}/{subrota-conhecida}/... */
function isPortalPublico(segments: string[]): boolean {
  if (segments.length === 0) return false;
  if (INTERNAL_ROUTES.has(segments[0])) return false;
  if (segments.length === 1) return true; // landing do estúdio
  return PORTAL_SUBROUTES.has(segments[1]);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Normalizar: lowercase, remover trailing slash (exceto na raiz exata)
  const path = pathname.toLowerCase().replace(/(.+)\/$/, "$1");

  // 1. Estáticos e API interna — sempre passam
  if (path.startsWith("/api/") || path.startsWith("/_next/")) {
    return NextResponse.next();
  }

  // Sessão ativa = access_token válido OU marcador de sessão (sk_session).
  // O access_token expira em 15 min; o marcador (7 dias) evita que um reload/deep-link
  // após a expiração jogue o usuário no /login — o client renova o token via /auth/refresh.
  const hasToken =
    Boolean(request.cookies.get("access_token")) ||
    Boolean(request.cookies.get("sk_session"));

  // 2. Páginas públicas exatas (auth + marketing)
  if (PUBLIC_EXACT.has(path)) {
    if (AUTH_ROUTES.has(path) && hasToken) {
      return NextResponse.redirect(new URL(DASHBOARD_ROOT, request.url));
    }
    return NextResponse.next();
  }

  const segments = path.split("/").filter(Boolean);

  // 3. Portal público por slug — sem sessão
  if (path !== DASHBOARD_ROOT && isPortalPublico(segments)) {
    return NextResponse.next();
  }

  // 4. DENY-BY-DEFAULT: raiz do dashboard, rotas internas conhecidas e QUALQUER
  //    caminho não reconhecido exigem autenticação.
  if (!hasToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)",
  ],
};
