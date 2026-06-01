import { afterEach, describe, expect, it, vi } from "vitest";

import { api, getCsrfToken, withCsrfHeaders } from "./client";

function setDocumentCookie(cookie: string) {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { cookie },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(globalThis, "document");
});

describe("CSRF headers", () => {
  it("reads the csrf_token cookie value", () => {
    setDocumentCookie("theme=dark; csrf_token=token%20123; access_token=abc");

    expect(getCsrfToken()).toBe("token 123");
  });

  it("adds X-CSRF-Token while preserving existing headers", () => {
    setDocumentCookie("csrf_token=secure-token");

    const init = withCsrfHeaders({
      method: "POST",
      headers: { Accept: "application/json" },
    });

    const headers = new Headers(init.headers);
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("X-CSRF-Token")).toBe("secure-token");
  });

  it("does not force JSON content type for multipart requests", () => {
    setDocumentCookie("csrf_token=upload-token");

    const init = withCsrfHeaders({
      method: "POST",
      body: new FormData(),
    });

    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBeNull();
    expect(headers.get("X-CSRF-Token")).toBe("upload-token");
  });

  it("sends X-CSRF-Token on JSON mutations", async () => {
    setDocumentCookie("csrf_token=mutation-token");
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.post("/api/v1/clientes/", { nome: "Ana" });

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    const init = calls[0][1];
    expect(init).toMatchObject({
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ nome: "Ana" }),
    });

    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-CSRF-Token")).toBe("mutation-token");
  });
});
