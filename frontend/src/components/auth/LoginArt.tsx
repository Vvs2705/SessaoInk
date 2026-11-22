"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

import { StatusChip } from "@/components/StatusChip";
import type { GrupoStatus } from "@/lib/status-atendimento";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP, DrawSVGPlugin, MotionPathPlugin);

/**
 * Arte do login (efeito "statement" da tela): um desenho fineline é tatuado
 * traço a traço por uma ponta de agulha e, ao fechar, revela a agenda do dia
 * (a prova do produto). Sem tela cheia e sem bloquear o formulário: a arte
 * vive numa coluna própria (>= lg) ou numa faixa compacta (celular).
 *
 * Movimento: `useGSAP` + scope + `gsap.matchMedia`. Com prefers-reduced-motion
 * nada anima e o desenho aparece completo (estado final). O desenho é
 * decorativo (aria-hidden); o formulário é o conteúdo da página.
 *
 * O resumo da agenda é um EXEMPLO fixo, rotulado como tal: o login acontece
 * antes de qualquer dado do estúdio existir na tela.
 */

type SessaoExemplo = {
  hora: string;
  nome: string;
  detalhe: string;
  grupo: GrupoStatus;
};

const SESSOES_EXEMPLO: SessaoExemplo[] = [
  { hora: "10:00", nome: "Thiago N.", detalhe: "Blackwork · braço", grupo: "concluido" },
  { hora: "14:00", nome: "Júlia N.", detalhe: "Oriental · costela", grupo: "em_sessao" },
  { hora: "17:30", nome: "Camila R.", detalhe: "Fineline · tornozelo", grupo: "pendente" },
];

const RESUMO_EXEMPLO = `Hoje · ${SESSOES_EXEMPLO.length} sessões · ${
  SESSOES_EXEMPLO.filter((s) => s.grupo === "pendente").length
} sinal pendente`;

/** Ramo de flor em fineline. Caminhos escritos em viewBox 0 0 300 360. */
function Flor({
  className,
  traco = 1.5,
}: {
  className?: string;
  /** Espessura do traço no viewBox; a versão compacta engrossa para não sumir. */
  traco?: number;
}) {
  return (
    <svg
      viewBox="0 0 300 360"
      fill="none"
      aria-hidden="true"
      className={cn("text-si-accent", className)}
    >
      <g stroke="currentColor" strokeWidth={traco} strokeLinecap="round" strokeLinejoin="round">
        {/* Haste principal: a agulha percorre este traço. */}
        <path
          data-ink-draw
          data-ink-stem
          d="M150 352 C150 300 110 270 118 220 C126 170 176 160 170 110 C167 90 156 82 150 76"
        />
        {/* Folhas */}
        <path data-ink-draw data-ink-leaf d="M118 220 C80 214 58 190 56 160 C90 160 114 182 118 220Z" />
        <path data-ink-draw data-ink-leaf d="M141 280 C181 276 213 252 219 218 C183 220 149 244 141 280Z" />
        <path data-ink-draw data-ink-leaf d="M172 150 C205 146 228 124 230 96 C200 98 176 118 172 150Z" />
        <path data-ink-draw data-ink-leaf d="M166 120 C140 118 120 100 118 76 C142 78 162 94 166 120Z" />
        {/* Nervuras */}
        <path data-ink-draw data-ink-vein d="M118 220 C98 202 80 186 62 168" />
        <path data-ink-draw data-ink-vein d="M141 280 C170 266 198 246 213 224" />
        <path data-ink-draw data-ink-vein d="M172 150 C196 140 214 124 224 104" />
        {/* Pétalas: a mesma gota girada em torno do centro da flor. */}
        {[0, 72, 144, 216, 288].map((angulo) => (
          <path
            key={angulo}
            data-ink-draw
            data-ink-petal
            d="M150 58 C138 42 140 20 150 10 C160 20 162 42 150 58Z"
            transform={`rotate(${angulo} 150 58)`}
          />
        ))}
        <circle data-ink-draw data-ink-vein cx={150} cy={58} r={4} />
      </g>

      {/* Pontilhado (dotwork) em volta da base. */}
      <g fill="currentColor">
        {[
          [96, 318], [108, 330], [196, 322], [206, 308], [86, 296],
          [214, 288], [70, 130], [236, 160], [92, 40], [208, 44],
        ].map(([cx, cy]) => (
          <circle
            key={`${cx}-${cy}`}
            data-ink-dot
            cx={cx}
            cy={cy}
            r={1.8}
            className="origin-center [transform-box:fill-box]"
          />
        ))}
      </g>

      {/* Ponta de agulha: acompanha a haste enquanto ela é desenhada. */}
      <g data-ink-needle opacity={0}>
        <circle r={3.2} className="fill-porcelain-ink [filter:drop-shadow(0_0_6px_var(--si-accent))]" />
      </g>
    </svg>
  );
}

export function LoginArt({ variant }: { variant: "panel" | "compact" }) {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      // Instância escondida pelo breakpoint: nada a animar, só garante que
      // apareça inteira se o viewport mudar depois.
      if (root.getClientRects().length === 0) {
        root.dataset.armed = "true";
        return;
      }

      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const q = gsap.utils.selector(root);
        const stem = root.querySelector<SVGPathElement>("[data-ink-stem]");
        const needle = root.querySelector<SVGGElement>("[data-ink-needle]");
        if (!stem || !needle) return;

        const folhas = q("[data-ink-leaf]");
        const nervuras = q("[data-ink-vein]");
        const petalas = q("[data-ink-petal]");
        const pontos = q("[data-ink-dot]");
        const cartao = q("[data-ink-card]");
        const linhas = q("[data-ink-row]");

        // Estado inicial (antes do primeiro paint do cliente): tudo por desenhar.
        gsap.set(q("[data-ink-draw]"), { drawSVG: "0%" });
        gsap.set(pontos, { opacity: 0, scale: 0 });
        gsap.set(cartao, { opacity: 0, y: 24 });
        if (linhas.length > 0) gsap.set(linhas, { opacity: 0, x: -12 });
        root.dataset.armed = "true";

        const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

        tl.to(needle, { opacity: 1, duration: 0.2 }, 0)
          .to(stem, { drawSVG: "100%", duration: 1.6, ease: "power1.inOut" }, 0.1)
          .to(
            needle,
            {
              motionPath: {
                path: stem,
                align: stem,
                alignOrigin: [0.5, 0.5],
              },
              duration: 1.6,
              ease: "power1.inOut",
            },
            0.1,
          )
          .to(folhas, { drawSVG: "100%", duration: 0.8, stagger: 0.14 }, 0.9)
          .to(petalas, { drawSVG: "100%", duration: 0.7, stagger: 0.1 }, 1.4)
          .to(nervuras, { drawSVG: "100%", duration: 0.6, stagger: 0.08 }, 1.8)
          .to(needle, { opacity: 0, duration: 0.3 }, 1.8)
          .to(pontos, { opacity: 1, scale: 1, duration: 0.4, stagger: 0.05 }, 2.0)
          .to(cartao, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, 2.3);

        if (linhas.length > 0) {
          tl.to(linhas, { opacity: 1, x: 0, duration: 0.45, stagger: 0.12 }, 2.6);
        }
      });
    },
    { scope: rootRef },
  );

  if (variant === "compact") {
    return (
      <section
        ref={rootRef}
        data-armed="false"
        aria-hidden="true"
        className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3 motion-safe:data-[armed=false]:invisible lg:hidden"
      >
        <Flor className="h-20 w-auto shrink-0" traco={3.5} />
        <p
          data-ink-card
          className="font-mono text-xs uppercase leading-relaxed tracking-wide text-muted-foreground"
        >
          {RESUMO_EXEMPLO}
        </p>
      </section>
    );
  }

  return (
    <aside
      ref={rootRef}
      data-armed="false"
      aria-hidden="true"
      className="relative hidden min-h-app flex-col justify-between gap-6 overflow-hidden border-r border-border bg-ink-night p-10 motion-safe:data-[armed=false]:invisible lg:flex xl:p-14"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,var(--si-accent-dim),transparent_55%)]"
        aria-hidden="true"
      />

      <p className="relative font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Gestão para tatuadores
      </p>

      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <Flor className="h-full max-h-[22rem] w-auto" />
      </div>

      <div className="relative space-y-5">
        <p className="max-w-md font-display text-3xl font-medium leading-tight tracking-tight text-foreground xl:text-4xl">
          Sua agenda do dia, na ordem em que importa.
        </p>

        <div
          data-ink-card
          className="max-w-md rounded-lg border border-border bg-card p-5 shadow-card"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-mono text-xs uppercase tracking-wide text-foreground">
              {RESUMO_EXEMPLO}
            </p>
            <span className="rounded-pill border border-border px-2 py-0.5 text-xs text-muted-foreground">
              Exemplo
            </span>
          </div>
          <ul className="divide-y divide-border">
            {SESSOES_EXEMPLO.map((s) => (
              <li
                key={s.hora}
                data-ink-row
                className="flex items-center gap-3 py-2.5 text-sm"
              >
                <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">
                  {s.hora}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-foreground">{s.nome}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {s.detalhe}
                  </span>
                </span>
                <StatusChip grupo={s.grupo} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}
