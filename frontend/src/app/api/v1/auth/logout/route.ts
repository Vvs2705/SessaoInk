import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "https://sessaoink-api.fly.dev";

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get("access_token")?.value;
  const refreshToken = request.cookies.get("refresh_token")?.value;

  // Revogar o refresh token no backend (best-effort)
  await fetch(`${BACKEND}/api/v1/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: [
        accessToken ? `access_token=${accessToken}` : "",
        refreshToken ? `refresh_token=${refreshToken}` : "",
      ]
        .filter(Boolean)
        .join("; "),
    },
  }).catch(() => {});

  const response = NextResponse.json({ message: "Logout realizado" });
  response.cookies.delete("access_token");
  response.cookies.delete("refresh_token");
  return response;
}
