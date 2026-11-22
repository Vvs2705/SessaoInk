"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/**
 * Número que sobe até o valor final uma única vez, ao montar. Serve para os
 * indicadores do período (movimento com propósito: dá leitura de "fechou o
 * mês"). Com prefers-reduced-motion o valor final aparece direto. O HTML
 * inicial já traz o valor final, então leitores de tela e SSR veem o número
 * correto.
 */
export function CountUp({
  value,
  format,
  className,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const estado = { v: 0 };
        el.textContent = format(0);
        gsap.to(estado, {
          v: value,
          duration: 1.1,
          ease: "power3.out",
          onUpdate: () => {
            el.textContent = format(estado.v);
          },
          onComplete: () => {
            el.textContent = format(value);
          },
        });
      });
    },
    { scope: ref },
  );

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}
