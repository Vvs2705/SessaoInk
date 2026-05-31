import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "https://sessaoink-api.fly.dev";

async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const qs = request.nextUrl.searchParams.toString();
  // Next.js may strip trailing slash from pathname; force it back for
  // single-segment paths (collection endpoints) so FastAPI doesn't redirect.
  const rawPathname = request.nextUrl.pathname; // e.g. /api/v1/clientes or /api/v1/clientes/
  const pathStr = path.join("/");
  // If the original URL had a trailing slash OR the path is a single segment
  // (indicating a collection endpoint like /clientes/), append the slash.
  const needsSlash = rawPathname.endsWith("/") || path.length === 1;
  const url = `${BACKEND}/api/v1/${pathStr}${needsSlash ? "/" : ""}${qs ? `?${qs}` : ""}`;
  console.log(`[PX] pathname=${rawPathname} url=${url}`);

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
