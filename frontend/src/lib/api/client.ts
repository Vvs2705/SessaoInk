/**
 * Cliente HTTP base para comunicação com a API SessãoInk.
 * Inclui tratamento de erros, retry e interceptors.
 */

// URL base: vazia em produção (usa proxy Next.js em /api/v1/) ou a URL direta do backend.
// Definir NEXT_PUBLIC_API_URL="" no Vercel para ativar o proxy mode.
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

export const api = {
  get: <T>(path: string, init?: RequestInit) =>
    fetch(`${API_URL}${path}`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...init,
    }).then((r) => handleResponse<T>(r)),

  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    fetch(`${API_URL}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      ...init,
    }).then((r) => handleResponse<T>(r)),

  patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
    fetch(`${API_URL}${path}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      ...init,
    }).then((r) => handleResponse<T>(r)),

  delete: <T>(path: string, init?: RequestInit) =>
    fetch(`${API_URL}${path}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...init,
    }).then((r) => handleResponse<T>(r)),
};
