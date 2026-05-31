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
  const rawCookie = request.headers.get("cookie") ?? "";
  console.log(`[DBG] tok:${!!accessToken} cookieLen:${rawCookie.length} path:${path.join("/")} method:${request.method}`);
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
    headers: {
      "Content-Type": contentType,
      "X-Debug-Tok": String(!!accessToken),
      "X-Debug-CLen": String(rawCookie.length),
      "X-Debug-TLen": String(accessToken?.length ?? 0),
    },
  });
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as PUT, proxy as DELETE };
