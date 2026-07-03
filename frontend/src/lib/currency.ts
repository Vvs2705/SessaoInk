export function maskCurrencyInput(raw: string): { display: string; value: string } {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return { display: "", value: "" };
  const amount = parseInt(digits, 10) / 100;
  return {
    value: amount.toFixed(2),
    display: new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount),
  };
}

/**
 * Formata um valor canônico (number ou string com ponto decimal) para
 * exibição "1.234,56" SEM o símbolo R$. Usado pelo CurrencyInput para
 * renderizar o valor controlado. Retorna "" quando vazio/inválido.
 */
export function formatCurrencyValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (!isFinite(n)) return "";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
