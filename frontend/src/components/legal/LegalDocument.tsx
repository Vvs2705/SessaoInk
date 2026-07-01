import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Casca visual compartilhada das páginas legais (Política de Privacidade,
 * Termos de Uso). Layout de leitura centrado, tokens do design system.
 */
export function LegalDocument({
  titulo,
  vigencia,
  versao,
  children,
}: {
  titulo: string;
  vigencia: string;
  versao: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-app bg-ink-night text-porcelain-ink">
      <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-text-subtle transition-colors hover:text-porcelain-ink"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Voltar
        </Link>

        <header className="mt-6 border-b border-mist-line pb-6">
          <h1 className="text-2xl font-bold text-porcelain-ink sm:text-3xl">{titulo}</h1>
          <p className="mt-2 text-xs text-text-subtle">
            Vigência: {vigencia} · Versão {versao}
          </p>
        </header>

        <article className="legal-prose mt-8 space-y-6 text-sm leading-relaxed text-text-subtle">
          {children}
        </article>
      </div>
    </main>
  );
}

/** Seção com título e corpo — padroniza o espaçamento entre blocos. */
export function LegalSection({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-porcelain-ink">{titulo}</h2>
      {children}
    </section>
  );
}
