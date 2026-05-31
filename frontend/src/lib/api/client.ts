// URL base: vazia em produção (usa proxy Next.js em /api/v1/) ou a URL direta do backend.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
    message?: string
  ) {
    super(message ?? detail);
    this.name = "ApiError";
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.ok) {
    if (res.status === 204) return undefined as T;
    return res.json();
  }
  let detail = `Erro ${res.status}`;
  try {
    const body = await res.json();
    detail = body?.detail ?? detail;
  } catch {}
  throw new ApiError(res.status, detail);
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchWithAuth<T>(fetchFn: () => Promise<Response>): Promise<T> {
  const res = await fetchFn();

  if (res.status !== 401) return handleResponse<T>(res);

  const refreshed = await tryRefresh();
  if (!refreshed) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new ApiError(401, "Sessão expirada. Faça login novamente.");
  }

  const retryRes = await fetchFn();
  return handleResponse<T>(retryRes);
}

export const api = {
  get: <T>(path: string, init?: RequestInit) =>
    fetchWithAuth<T>(() =>
      fetch(`${API_URL}${path}`, {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        ...init,
      })
    ),

  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    fetchWithAuth<T>(() =>
      fetch(`${API_URL}${path}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        ...init,
      })
    ),

  patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
    fetchWithAuth<T>(() =>
      fetch(`${API_URL}${path}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        ...init,
      })
    ),

  delete: <T>(path: string, init?: RequestInit) =>
    fetchWithAuth<T>(() =>
      fetch(`${API_URL}${path}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        ...init,
      })
    ),
};
