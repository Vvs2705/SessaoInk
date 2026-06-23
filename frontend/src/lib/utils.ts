import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata valor numérico como moeda brasileira: R$ 1.350,00 */
export function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val);
}

/**
 * Máscara de moeda para inputs (acumulador de centavos).
 *
 * Trata TODOS os dígitos digitados como centavos e formata no padrão
 * brasileiro, inserindo automaticamente milhar (.) e decimal (,).
 * Sem limite de caracteres e impossível digitar formato inválido.
 *
 * Ex.: digitar "4", "2", "1", "8", "5", "0" → display "4.218,50" / value "4218.50"
 *
 * @returns `display` para exibir no campo e `value` canônico (ponto decimal)
 *          pronto para `parseFloat`/envio à API.
 */
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
 * renderizar o valor controlado. Retorna "" quando vazio/ inválido.
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

/** Unidades discretas (contagem inteira) */
const UNIDADES_DISCRETAS = new Set(["un", "cx", "pct", "par"]);

/**
 * Formata quantidade de estoque:
 * - Unidades discretas (un, cx, pct, par) → inteiro: "10"
 * - Unidades contínuas (ml, g, kg, L, rolo) → decimal: "1,5"
 */
export function formatQuantity(val: number, unidade: string): string {
  if (UNIDADES_DISCRETAS.has(unidade)) {
    return String(Math.round(val));
  }
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(val);
}

/**
 * Retorna o step correto para inputs de quantidade no estoque.
 * Unidades discretas → "1", contínuas → "0.01"
 */
export function getQuantityStep(unidade: string): string {
  return UNIDADES_DISCRETAS.has(unidade) ? "1" : "0.01";
}
