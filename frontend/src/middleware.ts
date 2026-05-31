import { NextRequest, NextResponse } from "next/server";

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
];

const PUBLIC_AUTH_PATHS = ["/login", "/registro", "/senha"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Normalize path: lowercase and remove trailing slash (except for absolute root '/')
  const normalizedPath = pathname.toLowerCase().replace(/(.+)\/$/, "$1");

  // 1. Libera chamadas de API do Next/Backend e recursos estáticos do Next
  if (normalizedPath.startsWith("/api/") || normalizedPath.startsWith("/_next/")) {
    return NextResponse.next();
  }

  // 2. Libera rotas públicas de autenticação
  if (PUBLIC_AUTH_PATHS.some((path) => normalizedPath === path || normalizedPath.startsWith(path + "/"))) {
    return NextResponse.next();
  }

  // 3. Identifica se é uma rota protegida (dashboard)
  // É protegida se for exatamente "/" ou começar com um dos prefixos protegidos (seguido de "/" ou fim da string)
  const isDashboardRoute =
    normalizedPath === "/" ||
    PROTECTED_PREFIXES.some(
      (prefix) => normalizedPath === prefix || normalizedPath.startsWith(prefix + "/")
    );

  if (isDashboardRoute) {
    const token = request.cookies.get("access_token");

    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 4. Qualquer outra rota é tratada como portal público (slugs) e passa sem auth
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)",
  ],
};
