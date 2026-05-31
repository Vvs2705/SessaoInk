import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "https://sessaoink-api.fly.dev";

async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const qs = request.nextUrl.searchParams.toString();
  const url = `${BACKEND}/api/v1/${path.join("/")}${qs ? `?${qs}` : ""}`;

  const accessToken = request.cookies.get("access_token")?.value;

  const headers = new Headers({ "Content-Type": "application/json" });
  if (accessToken) headers.set("Cookie", `access_token=${accessToken}`);

  const hasBody = !["GET", "HEAD", "DELETE"].includes(request.method);

  let backendRes: Response;
  try {
    backendRes = await fetch(url, {
      method: request.method,
      headers,
      body: hasBody ? await request.text() : undefined,
    });
  } catch {
    return NextResponse.json({ detail: "Erro de conexão com o servidor" }, { status: 503 });
  }

  const contentType = backendRes.headers.get("content-type") ?? "application/json";
  const body = await backendRes.arrayBuffer();

  return new NextResponse(body, {
    status: backendRes.status,
    headers: { "Content-Type": contentType },
  });
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as PUT, proxy as DELETE };
