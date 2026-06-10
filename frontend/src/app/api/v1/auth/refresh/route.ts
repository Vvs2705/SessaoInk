import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "https://sessaoink-api.fly.dev";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get("refresh_token")?.value;
  const csrfToken = request.cookies.get("csrf_token")?.value;
  const incomingCsrfToken = request.headers.get("x-csrf-token");

  if (!refreshToken) {
    return NextResponse.json({ detail: "Refresh token não encontrado" }, { status: 401 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: [
          `refresh_token=${refreshToken}`,
          csrfToken ? `csrf_token=${csrfToken}` : "",
        ]
          .filter(Boolean)
          .join("; "),
        ...(incomingCsrfToken ? { "X-CSRF-Token": incomingCsrfToken } : {}),
      },
    });
  } catch {
    return NextResponse.json({ detail: "Erro de conexão com o servidor" }, { status: 503 });
  }

  const data = await backendRes.json().catch(() => ({}));
  const response = NextResponse.json(data, { status: backendRes.status });

  if (backendRes.ok) {
    const raw = backendRes.headers.get("set-cookie");
    if (raw) {
      raw.split(/,(?=\s*\w+=)/).forEach((c) =>
        response.headers.append("set-cookie", c.trim())
      );
    }

    // Renova o marcador de sessão (7 dias) a cada refresh bem-sucedido.
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
