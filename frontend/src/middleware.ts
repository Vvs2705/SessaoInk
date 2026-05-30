import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/registro", "/senha", "/_next", "/favicon", "/api/auth"];
const PUBLIC_PORTAL = /^\/[a-z0-9-]+($|\/)/; // /[slug] e sub-rotas públicas

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rotas públicas sempre passam
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Portal público (slugs) passa sem auth
  if (pathname.match(/^\/[a-z0-9][a-z0-9-]*($|\/orcamento|\/portfolio|\/flash-arts)/)) {
    return NextResponse.next();
  }

  // Verificar cookie de sessão
  const token = request.cookies.get("access_token");

  if (!token) {
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
