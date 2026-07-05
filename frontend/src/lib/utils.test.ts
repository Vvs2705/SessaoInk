import { describe, expect, it } from "vitest";

import { formatCurrencyValue, maskCurrencyInput } from "@/lib/currency";

describe("maskCurrencyInput (acumulador de centavos)", () => {
  it("formata os dígitos do bug relatado (R$ 4.218,50)", () => {
    // Usuário digita "4","2","1","8","5","0"
    expect(maskCurrencyInput("421850")).toEqual({
      value: "4218.50",
      display: "4.218,50",
    });
  });

  it("re-deriva a partir do texto já mascarado (digitação incremental)", () => {
    // O campo mostra "4.218,5" e o usuário digita "0" no fim
    expect(maskCurrencyInput("4.218,50")).toEqual({
      value: "4218.50",
      display: "4.218,50",
    });
  });

  it("trata o primeiro dígito como centavo", () => {
    expect(maskCurrencyInput("5")).toEqual({ value: "0.05", display: "0,05" });
  });

  it("retorna vazio quando não há dígitos", () => {
    expect(maskCurrencyInput("")).toEqual({ display: "", value: "" });
    expect(maskCurrencyInput("R$ ,.")).toEqual({ display: "", value: "" });
  });

  it("não limita a quantidade de caracteres (valores grandes)", () => {
    expect(maskCurrencyInput("123456789")).toEqual({
      value: "1234567.89",
      display: "1.234.567,89",
    });
  });

  it("ignora letras e símbolos e é idempotente sobre texto já mascarado", () => {
    // "R$ 1.000,00abc" → dígitos "100000" → 1000,00 (re-mascarar não infla o valor)
    expect(maskCurrencyInput("R$ 1.000,00abc")).toEqual({
      value: "1000.00",
      display: "1.000,00",
    });
  });
});

describe("formatCurrencyValue (valor canônico → exibição BRL sem símbolo)", () => {
  it("formata string canônica com ponto decimal", () => {
    expect(formatCurrencyValue("4218.5")).toBe("4.218,50");
  });

  it("formata número", () => {
    expect(formatCurrencyValue(4218.5)).toBe("4.218,50");
  });

  it("retorna vazio para valores ausentes", () => {
    expect(formatCurrencyValue("")).toBe("");
    expect(formatCurrencyValue(null)).toBe("");
    expect(formatCurrencyValue(undefined)).toBe("");
  });

  it("formata zero como 0,00", () => {
    expect(formatCurrencyValue(0)).toBe("0,00");
  });
});
