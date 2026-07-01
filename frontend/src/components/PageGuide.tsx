"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, X, Lightbulb } from "lucide-react";
import { resolveGuide } from "@/lib/page-guides";

/**
 * Guia contextual por página. Botão flutuante "?" que abre um painel explicando
 * o que a página faz, como usar e para que serve. Resolve o conteúdo pela rota.
 */
export function PageGuide() {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const guia = resolveGuide(pathname);

  // Fecha ao trocar de página
  useEffect(() => {
    setAberto(false);
  }, [pathname]);

  // ESC fecha
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto]);

  if (!guia) return null;

  return (
    <>
      {/* Botão flutuante */}
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label={`Ajuda da página: ${guia.titulo}`}
        title="Como usar esta página"
        className="fixed z-40 bottom-20 right-4 lg:bottom-6 lg:right-6 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-teal-ink text-ink-night font-semibold shadow-lg hover:bg-[#34a394] transition-colors"
      >
        <HelpCircle size={18} className="shrink-0" />
        <span className="hidden sm:inline text-sm">Como usar</span>
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label={`Guia: ${guia.titulo}`}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setAberto(false)}
          />

          {/* Painel */}
          <div className="relative w-full max-w-md h-full overflow-y-auto bg-ink-bg border-l border-mist-line shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 bg-ink-bg border-b border-mist-line">
              <div className="flex items-center gap-2">
                <HelpCircle size={18} className="text-teal-ink" />
                <h2 className="text-porcelain-ink font-semibold">{guia.titulo}</h2>
              </div>
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar guia"
                className="p-1.5 rounded-[8px] text-text-subtle hover:text-porcelain-ink hover:bg-surface-raised transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-5 space-y-6">
              <section>
                <h3 className="text-[11px] uppercase tracking-wide text-text-subtle mb-1.5">
                  O que faz
                </h3>
                <p className="text-sm text-porcelain-ink/90 leading-relaxed">
                  {guia.oQueFaz}
                </p>
              </section>

              <section>
                <h3 className="text-[11px] uppercase tracking-wide text-text-subtle mb-2">
                  Como usar
                </h3>
                <ol className="space-y-2">
                  {guia.comoUsar.map((passo, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-porcelain-ink/90">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-teal-ink/15 text-teal-ink text-xs flex items-center justify-center font-semibold">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{passo}</span>
                    </li>
                  ))}
                </ol>
              </section>

              <section>
                <h3 className="text-[11px] uppercase tracking-wide text-text-subtle mb-1.5">
                  Para que serve
                </h3>
                <p className="text-sm text-porcelain-ink/90 leading-relaxed">
                  {guia.paraQueServe}
                </p>
              </section>

              {guia.dicas && guia.dicas.length > 0 && (
                <section className="rounded-[14px] bg-copper-needle/10 border border-copper-needle/20 p-3.5">
                  <h3 className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-copper-needle mb-1.5">
                    <Lightbulb size={13} /> Dica
                  </h3>
                  <ul className="space-y-1">
                    {guia.dicas.map((dica, i) => (
                      <li key={i} className="text-sm text-porcelain-ink/90 leading-relaxed">
                        {dica}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
