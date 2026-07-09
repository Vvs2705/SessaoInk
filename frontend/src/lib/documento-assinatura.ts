/**
 * Helpers do fluxo público de assinatura de documentos por token.
 *
 * O backend (POST /api/v1/public/documentos/token/{token}/assinar) espera
 * FORM data (application/x-www-form-urlencoded) — nunca JSON.
 */

/** Monta o corpo FORM esperado pelo endpoint público de assinatura. */
export function buildAssinarFormBody(nomeAssinante: string): URLSearchParams {
  return new URLSearchParams({ nome_assinante: nomeAssinante.trim() });
}

/** Mensagem amigável pt-BR para erros do fluxo público por token. */
export function mensagemErroToken(status: number, detail?: string | null): string {
  if (status === 404) {
    return "Este link é inválido, expirou ou já foi utilizado. Peça um novo link ao estúdio.";
  }
  if (detail) return detail;
  return "Não foi possível concluir a operação. Tente novamente em instantes.";
}
