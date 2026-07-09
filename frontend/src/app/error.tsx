"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { Home, RotateCcw } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Reporta ao Sentry (só ativo em produção — ver sentry.client.config.ts).
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink-night px-4 py-12 text-center">
      <div className="w-full max-w-md motion-safe:animate-fade-in">
        <BrandLogo size="lg" className="mx-auto" scaling={false} />

        <h1 className="mt-8 font-display text-3xl font-semibold text-porcelain-ink">
          Algo saiu do prumo
        </h1>
        <p className="mt-3 text-sm leading-6 text-text-subtle">
          Tivemos um imprevisto ao carregar esta página. Nossa equipe já foi
          avisada. Você pode tentar de novo ou voltar ao início.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="flex h-12 items-center justify-center gap-2 rounded-lg bg-teal-ink px-6 font-bold text-ink-night transition hover:bg-ink-gold"
          >
            <RotateCcw size={18} />
            Tentar novamente
          </button>

          <Link
            href="/"
            className="flex h-12 items-center justify-center gap-2 rounded-lg border border-mist-line px-6 font-semibold text-porcelain-ink transition hover:border-teal-ink hover:text-teal-ink"
          >
            <Home size={18} />
            Voltar ao início
          </Link>
        </div>

        {error.digest && (
          <p className="mt-8 font-mono text-xs text-text-subtle">
            Código do erro: {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
