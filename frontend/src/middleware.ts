import { NextRequest, NextResponse } from "next/server";

const PRIVATE_PATHS = [
  "/agenda",
  "/atendimentos",
  "/clientes",
  "/financeiro",
  "/documentos",
  "/estoque",
  "/relatorios",
  "/configuracoes",
  "/mais",
  "/portfolio",
  "/flash-arts"
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isRoot = pathname === "/";
  const isPrivate =
    isRoot ||
    PRIVATE_PATHS.some(
      (path) => pathname === path || pathname.startsWith(path + "/")
    );

  if (isPrivate) {
    const token = request.cookies.get("access_token");

    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)",
  ],
};
