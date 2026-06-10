import { NextRequest, NextResponse } from "next/server";

// Rotas que exigem autenticação — qualquer rota não listada aqui é tratada
// como pública (portal do cliente por slug) ou recurso estático.
const PROTECTED_PREFIXES = [
  "/agenda",
  "/atendimentos",
  "/clientes",
  "/configuracoes",
  "/documentos",
  "/estoque",
  "/financeiro",
  "/flash-arts",
  "/portfolio",
  "/relatorios",
  "/mais",
  "/usuarios",
  "/assinatura",
  "/billing",
  "/admin",
];

// Rotas de autenticação — usuário JÁ autenticado é redirecionado ao dashboard
const AUTH_ROUTES = ["/login", "/registro", "/senha"];

// Raiz do dashboard (também protegida)
const DASHBOARD_ROOT = "/";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Normalizar: lowercase, remover trailing slash (exceto na raiz exata)
  const path = pathname.toLowerCase().replace(/(.+)\/$/, "$1");

  // 1. Recursos estáticos e API interna — passam sempre
  if (path.startsWith("/api/") || path.startsWith("/_next/")) {
    return NextResponse.next();
  }

  // Sessão ativa = access_token válido OU marcador de sessão (sk_session).
  // O access_token expira em 15 min; o marcador (7 dias) evita que um reload/deep-link
  // após a expiração jogue o usuário no /login — o client renova o token via /auth/refresh.
  const hasToken =
    Boolean(request.cookies.get("access_token")) ||
    Boolean(request.cookies.get("sk_session"));

  // 2. Rotas de autenticação (/login, /registro, /senha)
  //    Se o usuário já está autenticado, redireciona para o dashboard.
  const isAuthRoute = AUTH_ROUTES.some(
    (r) => path === r || path.startsWith(r + "/")
  );
  if (isAuthRoute) {
    if (hasToken) {
      return NextResponse.redirect(new URL(DASHBOARD_ROOT, request.url));
    }
    return NextResponse.next();
  }

  // 3. Rotas protegidas do dashboard
  const isDashboard =
    path === DASHBOARD_ROOT ||
    PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));

  if (isDashboard) {
    if (!hasToken) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 4. Qualquer outra rota é portal público (/:slug, /:slug/orcamento, etc.)
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)",
  ],
};
