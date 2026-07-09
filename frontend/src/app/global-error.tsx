"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// global-error substitui o root layout (que importa o globals.css), então os
// tokens não chegariam aqui — importamos direto para manter zero cor literal.
// Fraunces/Outfit (next/font) não carregam sem o layout; as classes font-*
// degradam para serif/system-ui, aceitável neste fallback de última instância.
import "../styles/globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink-night px-4 py-12 text-center font-sans text-porcelain-ink">
        <h1 className="font-display text-2xl font-semibold text-porcelain-ink">
          Erro inesperado
        </h1>
        <p className="max-w-sm text-sm leading-6 text-text-subtle">
          Não conseguimos carregar o SessãoInk agora. Tente novamente em
          instantes.
        </p>
        <button
          type="button"
          onClick={reset}
          className="h-12 rounded-lg bg-teal-ink px-6 font-bold text-ink-night transition hover:bg-ink-gold"
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}
