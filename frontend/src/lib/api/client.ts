import { captureAppEvent } from "../posthog";

// URL base: vazia em produção (usa proxy Next.js em /api/v1/) ou a URL direta do backend.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const CSRF_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

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
    const d = body?.detail;
    // O 402 de assinatura devolve detail estruturado {motivo, mensagem}.
    detail = (typeof d === "string" ? d : d?.mensagem) ?? detail;
  } catch {}

  // 402 = assinatura exigida (trial expirado/assinatura vencida). Leva o usuário
  // direto à aba de assinatura — exceto se já está lá (evita loop de reload).
  if (
    res.status === 402 &&
    typeof window !== "undefined" &&
    !window.location.pathname.startsWith("/configuracoes")
  ) {
    window.location.href = "/configuracoes?assinatura=1";
  }

  throw new ApiError(res.status, detail);
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
      ...withCsrfHeaders({ method: "POST" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
}

export function getCsrfToken(): string | null {
  const token = getCookie("csrf_token");
  return token ? decodeURIComponent(token) : null;
}

export function withCsrfHeaders(init: RequestInit = {}): RequestInit {
  const nextHeaders = new Headers(init.headers ?? {});
  const method = init.method?.toUpperCase() ?? "POST";

  const token = getCsrfToken();
  if (token && CSRF_METHODS.has(method) && !nextHeaders.has("X-CSRF-Token")) {
    nextHeaders.set("X-CSRF-Token", token);
  }

  return {
    ...init,
    headers: nextHeaders,
  };
}

function withJsonHeaders(method: string, init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return withCsrfHeaders({ ...init, method, headers });
}

async function fetchWithAuth<T>(fetchFn: () => Promise<Response>): Promise<T> {
  const res = await fetchFn();

  if (res.status !== 401) return handleResponse<T>(res);

  const refreshed = await tryRefresh();
  if (!refreshed) {
    if (typeof window !== "undefined") {
      // Limpa os cookies de sessão (inclusive o marcador sk_session) ANTES de ir
      // ao /login — senão o middleware vê o marcador, devolve para o dashboard e
      // o app entra em loop infinito de 401/redirect.
      try {
        await fetch(`${API_URL}/api/v1/auth/logout`, {
          method: "POST",
          credentials: "include",
          ...withCsrfHeaders({ method: "POST" }),
        });
      } catch {}
      window.location.href = "/login";
    }
    throw new ApiError(401, "Sessão expirada. Faça login novamente.");
  }

  const retryRes = await fetchFn();
  return handleResponse<T>(retryRes);
}

function mutationEvent(method: string, path: string): string | null {
  if (method === "POST" && path.includes("/auth/login")) return "auth_login";
  if (path.includes("/clientes")) return "cliente_mutation";
  if (path.includes("/agenda")) return "agenda_mutation";
  if (path.includes("/atendimentos")) return "atendimento_mutation";
  if (path.includes("/financeiro")) return "pagamento_mutation";
  if (path.includes("/documentos")) return "documento_mutation";
  if (path.includes("/portfolio")) return "portfolio_mutation";
  if (path.includes("/flash-arts")) return "flash_art_mutation";
  return null;
}

function captureMutation(method: string, path: string, status: "success" | "error") {
  const event = mutationEvent(method, path);
  if (!event) return;
  captureAppEvent(event, { method, path, status });
}

export const api = {
  get: <T>(path: string, init?: RequestInit) =>
    fetchWithAuth<T>(() =>
      fetch(`${API_URL}${path}`, {
        ...withJsonHeaders("GET", init),
        credentials: "include",
        method: "GET",
      })
    ),

  post: async <T>(path: string, body?: unknown, init?: RequestInit) => {
    try {
      const result = await fetchWithAuth<T>(() =>
        fetch(`${API_URL}${path}`, {
          ...withJsonHeaders("POST", init),
          credentials: "include",
          method: "POST",
          body: body !== undefined ? JSON.stringify(body) : undefined,
        })
      );
      captureMutation("POST", path, "success");
      return result;
    } catch (error) {
      captureMutation("POST", path, "error");
      throw error;
    }
  },

  patch: async <T>(path: string, body?: unknown, init?: RequestInit) => {
    try {
      const result = await fetchWithAuth<T>(() =>
        fetch(`${API_URL}${path}`, {
          ...withJsonHeaders("PATCH", init),
          credentials: "include",
          method: "PATCH",
          body: body !== undefined ? JSON.stringify(body) : undefined,
        })
      );
      captureMutation("PATCH", path, "success");
      return result;
    } catch (error) {
      captureMutation("PATCH", path, "error");
      throw error;
    }
  },

  delete: async <T>(path: string, init?: RequestInit) => {
    try {
      const result = await fetchWithAuth<T>(() =>
        fetch(`${API_URL}${path}`, {
          ...withJsonHeaders("DELETE", init),
          credentials: "include",
          method: "DELETE",
        })
      );
      captureMutation("DELETE", path, "success");
      return result;
    } catch (error) {
      captureMutation("DELETE", path, "error");
      throw error;
    }
  },
};
