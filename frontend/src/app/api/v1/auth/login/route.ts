import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "https://sessaoink-api.fly.dev";

export async function POST(request: NextRequest) {
  const body = await request.text();

  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  }

  return response;
}
