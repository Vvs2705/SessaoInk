"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Carregado só no cliente e só quando há animationData (telas com fallback SVG
// não pagam o custo do Lottie no bundle).
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  /**
   * animationData de um Lottie (ex.: import de `/public/lottie/empty-state.json`).
   * Quando ausente, renderiza o fallback SVG (gota de tinta) com pulso sutil.
   */
  lottie?: unknown;
  /** Ícone SVG customizado no lugar da gota padrão (fallback quando sem lottie). */
  icon?: ReactNode;
  className?: string;
}

/**
 * Estado vazio padrão V-STACK — para telas sem registros (sem clientes, sem
 * lançamentos, sem resultados etc.).
 *
 * Usa apenas tokens semânticos shadcn (`text-primary`, `text-foreground`,
 * `text-muted-foreground`, `font-display`) — a identidade de cada produto
 * entra via mapeamento de tokens do consumidor, não aqui.
 */
export function EmptyState({
  title,
  description,
  action,
  lottie,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        "px-6 py-14 animate-in fade-in slide-in-from-bottom-1 duration-300",
        className,
      )}
    >
      <div className="mb-5 h-16 w-16 text-primary">
        {lottie ? (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <Lottie animationData={lottie as any} loop className="h-full w-full" />
        ) : (
          icon ?? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-full w-full opacity-80 motion-safe:animate-pulse"
              aria-hidden="true"
            >
              <path d="M12 3c3 4 5 6.5 5 9.5a5 5 0 0 1-10 0C7 9.5 9 7 12 3z" />
              <path d="M9.5 13.5a2.5 2.5 0 0 0 2.5 2.5" />
            </svg>
          )
        )}
      </div>

      <h3 className="font-display text-xl text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
