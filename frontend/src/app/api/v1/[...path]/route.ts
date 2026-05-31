import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "https://sessaoink-api.fly.dev";

async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  await params; // consume params (required in Next.js 15)
  // Use the original pathname to preserve trailing slashes.
  // params.path strips the trailing slash (e.g. /clientes/ → ["clientes"]),
  // which causes FastAPI to issue a 307 redirect that drops the Cookie header.
  const originalPath = request.nextUrl.pathname.replace(/^\/api\/v1\//, "");
  const qs = request.nextUrl.searchParams.toString();
  const url = `${BACKEND}/api/v1/${originalPath}${qs ? `?${qs}` : ""}`;

  const accessToken = request.cookies.get("access_token")?.value;
  const incomingContentType = request.headers.get("content-type") ?? "";
  const isMultipart =
    incomingContentType.includes("multipart/form-data") ||
    incomingContentType.includes("application/x-www-form-urlencoded");

  const headers = new Headers();
  if (accessToken) headers.set("Cookie", `access_token=${accessToken}`);

  const hasBody = !["GET", "HEAD", "DELETE"].includes(request.method);

  let body: ArrayBuffer | string | undefined;
  if (hasBody) {
    if (isMultipart) {
      // Forward raw bytes + original Content-Type (includes multipart boundary)
      headers.set("Content-Type", incomingContentType);
      body = await request.arrayBuffer();
    } else {
      headers.set("Content-Type", "application/json");
      body = await request.text();
    }
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(url, {
      method: request.method,
      headers,
      body,
    });
  } catch {
    return NextResponse.json({ detail: "Erro de conexão com o servidor" }, { status: 503 });
  }

  const contentType = backendRes.headers.get("content-type") ?? "application/json";
  const resBody = await backendRes.arrayBuffer();

  return new NextResponse(resBody, {
    status: backendRes.status,
    headers: { "Content-Type": contentType },
  });
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as PUT, proxy as DELETE };
