/**
 * Decisão de CSRF por Origin no proxy `/api/v1/*` (defesa em camadas).
 *
 * Um request mutável é permitido quando:
 *  - não tem header Origin (same-origin puro — o browser omite Origin), OU
 *  - o Origin bate com o host que serve a rota (`selfOrigin`) — same-origin,
 *    impossível ser CSRF, e funciona em qualquer domínio servido, OU
 *  - o Origin bate com o domínio canônico (`appOrigin` = NEXT_PUBLIC_APP_URL).
 *
 * Cross-origin de terceiro (evil.com) não bate com nenhum → bloqueado.
 */
export function originPermitido(
  origin: string | null,
  appOrigin: string,
  selfOrigin: string | null,
): boolean {
  if (!origin) return true; // same-origin: browser não envia Origin
  return origin === appOrigin || origin === selfOrigin;
}
