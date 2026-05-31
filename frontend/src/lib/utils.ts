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
