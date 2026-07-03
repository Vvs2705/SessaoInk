"use client";

import * as React from "react";

import { formatCurrencyValue, maskCurrencyInput } from "@/lib/currency";

type CurrencyInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "inputMode"
> & {
  /** Valor canônico com ponto decimal (ex.: "4218.50") ou "" quando vazio. */
  value: string;
  /** Recebe o valor canônico já normalizado, pronto para parseFloat/API. */
  onValueChange: (value: string) => void;
};

/**
 * Input de moeda brasileira com máscara automática (acumulador de centavos).
 *
 * Substitui `<input type="number">` para campos monetários: ao digitar os
 * números, insere automaticamente milhar (.) e decimal (,) — ex.: digitar
 * "421850" vira "4.218,50". Não há limite de caracteres e é impossível
 * digitar um formato inválido (apenas dígitos são aceitos).
 *
 * O `value` é sempre canônico (ponto decimal) para manter compatibilidade
 * com `parseFloat`/envio nos formulários (react-hook-form friendly).
 */
export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  function CurrencyInput({ value, onValueChange, ...props }, ref) {
    return (
      <input
        {...props}
        ref={ref}
        type="text"
        inputMode="numeric"
        value={formatCurrencyValue(value)}
        onChange={(e) => onValueChange(maskCurrencyInput(e.target.value).value)}
      />
    );
  }
);
