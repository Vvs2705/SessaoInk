import { NextResponse } from "next/server";

/** Lê todos os Set-Cookie de uma resposta de fetch, cobrindo runtimes onde
 *  headers.get("set-cookie") retorna null (a spec do Fetch exclui set-cookie
 *  do get(); o getSetCookie() é o caminho padrão; o split é fallback). */
export function lerSetCookies(res: Response): string[] {
  const h = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof h.getSetCookie === "function") {
    const list = h.getSetCookie();
    if (list.length > 0) return list;
  }
  const raw = res.headers.get("set-cookie");
  if (!raw) return [];
  return raw.split(/,(?=\s*\w+=)/).map((c) => c.trim()).filter(Boolean);
}

/** Regrava um Set-Cookie cru na NextResponse via API cookies.set — o caminho
 *  de escrita que a serialização da Vercel preserva de forma confiável para
 *  múltiplos cookies (append direto de headers "set-cookie" é descartado). */
export function aplicarCookie(response: NextResponse, raw: string): void {
  const [par, ...attrs] = raw.split(";").map((p) => p.trim());
  const eq = par.indexOf("=");
  if (eq <= 0) return;
  const name = par.slice(0, eq);
  const value = par.slice(eq + 1);

  const lower = attrs.map((a) => a.toLowerCase());
  const getAttr = (k: string) => {
    const i = lower.findIndex((a) => a.startsWith(`${k}=`));
    return i >= 0 ? attrs[i].slice(k.length + 1) : undefined;
  };

  const maxAgeRaw = getAttr("max-age");
  const sameSiteRaw = (getAttr("samesite") ?? "lax").toLowerCase();
  response.cookies.set(name, value, {
    path: getAttr("path") ?? "/",
    httpOnly: lower.includes("httponly"),
    secure: lower.includes("secure"),
    sameSite: (["lax", "strict", "none"].includes(sameSiteRaw)
      ? sameSiteRaw
      : "lax") as "lax" | "strict" | "none",
    ...(maxAgeRaw ? { maxAge: parseInt(maxAgeRaw, 10) } : {}),
  });
}
