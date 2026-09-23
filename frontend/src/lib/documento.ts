/**
 * CPF/CNPJ do contratante — espelha backend/app/core/documento_fiscal.py.
 * Exigido para emitir a NFS-e da assinatura (padrão nacional + Caieiras/SP).
 */

const MOLDE_CPF = "000.000.000-00";
const MOLDE_CNPJ = "00.000.000/0000-00";

/** Só alfanuméricos, em maiúsculas (o CNPJ alfanumérico usa letras). */
export function unmaskDocumento(valor: string): string {
  return valor.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

/** Preenche o molde parando assim que os caracteres acabam (máscara progressiva). */
function aplicarMolde(limpo: string, molde: string): string {
  let i = 0;
  let out = "";
  for (const c of molde) {
    if (i >= limpo.length) break;
    out += c === "0" ? limpo[i++] : c;
  }
  return out;
}

export function maskDocumento(valor: string): string {
  const limpo = unmaskDocumento(valor).slice(0, 14);
  return aplicarMolde(limpo, limpo.length <= 11 ? MOLDE_CPF : MOLDE_CNPJ);
}

/** Dígito verificador módulo 11. `charCodeAt - 48` cobre o CNPJ alfanumérico. */
function dv(base: string, pesos: number[]): number {
  const soma = base
    .split("")
    .reduce((acc, c, i) => acc + (c.charCodeAt(0) - 48) * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function isDocumentoValido(valor: string): boolean {
  const limpo = unmaskDocumento(valor);
  let base: string;
  let pesos1: number[];
  let pesos2: number[];

  if (limpo.length === 11) {
    if (!/^\d{11}$/.test(limpo) || limpo === limpo[0].repeat(11)) return false;
    base = limpo.slice(0, 9);
    pesos1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
    pesos2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
  } else if (limpo.length === 14) {
    // Os 12 primeiros caracteres podem ser alfanuméricos; os 2 DVs, nunca.
    if (!/^\d{2}$/.test(limpo.slice(12)) || limpo === limpo[0].repeat(14)) return false;
    base = limpo.slice(0, 12);
    pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  } else {
    return false;
  }

  const d1 = dv(base, pesos1);
  const d2 = dv(`${base}${d1}`, pesos2);
  return limpo.endsWith(`${d1}${d2}`);
}
