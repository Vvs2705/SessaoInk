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
        className="fixed z-40 bottom-20 right-4 lg:bottom-6 lg:right-6 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-[#2F9285] text-[#050B12] font-semibold shadow-lg hover:bg-[#34a394] transition-colors"
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
          <div className="relative w-full max-w-md h-full overflow-y-auto bg-[#0B171C] border-l border-[#243337] shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 bg-[#0B171C] border-b border-[#243337]">
              <div className="flex items-center gap-2">
                <HelpCircle size={18} className="text-[#2F9285]" />
                <h2 className="text-[#F0EADD] font-semibold">{guia.titulo}</h2>
              </div>
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar guia"
                className="p-1.5 rounded-[8px] text-[#87938F] hover:text-[#F0EADD] hover:bg-[#102128] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-5 space-y-6">
              <section>
                <h3 className="text-[11px] uppercase tracking-wide text-[#87938F] mb-1.5">
                  O que faz
                </h3>
                <p className="text-sm text-[#F0EADD]/90 leading-relaxed">
                  {guia.oQueFaz}
                </p>
              </section>

              <section>
                <h3 className="text-[11px] uppercase tracking-wide text-[#87938F] mb-2">
                  Como usar
                </h3>
                <ol className="space-y-2">
                  {guia.comoUsar.map((passo, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-[#F0EADD]/90">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-[#2F9285]/15 text-[#2F9285] text-xs flex items-center justify-center font-semibold">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{passo}</span>
                    </li>
                  ))}
                </ol>
              </section>

              <section>
                <h3 className="text-[11px] uppercase tracking-wide text-[#87938F] mb-1.5">
                  Para que serve
                </h3>
                <p className="text-sm text-[#F0EADD]/90 leading-relaxed">
                  {guia.paraQueServe}
                </p>
              </section>

              {guia.dicas && guia.dicas.length > 0 && (
                <section className="rounded-[14px] bg-[#C36B3F]/10 border border-[#C36B3F]/20 p-3.5">
                  <h3 className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[#C36B3F] mb-1.5">
                    <Lightbulb size={13} /> Dica
                  </h3>
                  <ul className="space-y-1">
                    {guia.dicas.map((dica, i) => (
                      <li key={i} className="text-sm text-[#F0EADD]/90 leading-relaxed">
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
