"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock } from "lucide-react";
import Link from "next/link";

import { api } from "@/lib/api/client";

/** Shape do resumo — backend/app/services/assinatura.py::resumo */
type AssinaturaResumo = {
  status: string;
  acesso_liberado: boolean;
  trial: boolean;
  dias_restantes_trial: number | null;
  periodo_fim: string | null;
  precisa_assinar: boolean;
  motivo_bloqueio: string | null;
};

const MENSAGENS_BLOQUEIO: Record<string, string> = {
  trial_expirado: "Seu período de teste terminou.",
  assinatura_expirada: "Sua assinatura expirou.",
  suspensa: "Sua assinatura está suspensa.",
  inadimplente: "Há um pagamento pendente na sua assinatura.",
  cancelada: "Sua assinatura foi cancelada.",
  sem_assinatura: "Seu estúdio não possui uma assinatura ativa.",
};

/** Dias até o fim do período pago (null quando não há periodo_fim). */
function diasAteFim(periodoFim: string | null): number | null {
  if (!periodoFim) return null;
  return Math.ceil((new Date(periodoFim).getTime() - Date.now()) / 86_400_000);
}

/**
 * Banner persistente de estado da assinatura no dashboard:
 * - Trial: dias restantes (âmbar quando restam ≤ 3 dias).
 * - Bloqueado (trial/assinatura expirada, suspensa...): aviso vermelho + CTA.
 * - Assinatura avulsa perto de vencer (≤ 7 dias): aviso âmbar de renovação.
 */
export function AssinaturaBanner() {
  const { data: resumo } = useQuery<AssinaturaResumo>({
    queryKey: ["assinatura-resumo"],
    queryFn: () => api.get<AssinaturaResumo>("/api/v1/pagamentos/assinatura"),
    staleTime: 60_000,
  });

  if (!resumo) return null;

  const cta = (
    <Link
      href="/configuracoes?assinatura=1"
      className="shrink-0 rounded-[10px] bg-teal-ink px-3 py-1.5 text-xs font-semibold text-ink-night transition-all hover:bg-teal-ink/90"
    >
      Ver planos
    </Link>
  );

  // Bloqueado — aviso vermelho persistente.
  if (resumo.precisa_assinar) {
    const mensagem =
      MENSAGENS_BLOQUEIO[resumo.motivo_bloqueio ?? ""] ??
      MENSAGENS_BLOQUEIO.sem_assinatura;
    return (
      <div
        role="alert"
        className="flex items-center gap-3 border-b border-error-red/30 bg-error-red/10 px-4 py-2.5 sm:px-5 lg:px-8"
      >
        <AlertTriangle size={16} className="shrink-0 text-error-red" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-xs text-porcelain-ink sm:text-sm">
          <strong>{mensagem}</strong>{" "}
          <span className="text-text-subtle">
            Assine um plano para voltar a usar o SessãoInk.
          </span>
        </p>
        {cta}
      </div>
    );
  }

  // Trial vigente — mostra os dias restantes (âmbar quando está acabando).
  if (resumo.trial && resumo.dias_restantes_trial !== null) {
    const dias = resumo.dias_restantes_trial;
    const urgente = dias <= 3;
    return (
      <div
        role="status"
        className={
          urgente
            ? "flex items-center gap-3 border-b border-warning/30 bg-warning/10 px-4 py-2.5 sm:px-5 lg:px-8"
            : "flex items-center gap-3 border-b border-ink-border bg-ink-surface px-4 py-2.5 sm:px-5 lg:px-8"
        }
      >
        <Clock
          size={16}
          className={urgente ? "shrink-0 text-warning" : "shrink-0 text-teal-ink"}
          aria-hidden="true"
        />
        <p className="min-w-0 flex-1 text-xs text-porcelain-ink sm:text-sm">
          <strong>
            Período de teste: {dias} dia{dias === 1 ? "" : "s"} restante
            {dias === 1 ? "" : "s"}.
          </strong>{" "}
          <span className="text-text-subtle">
            Assine para não perder o acesso ao seu estúdio.
          </span>
        </p>
        {cta}
      </div>
    );
  }

  // Assinatura avulsa perto de vencer — aviso de renovação.
  const diasFim = diasAteFim(resumo.periodo_fim);
  if (resumo.status === "ATIVA" && diasFim !== null && diasFim <= 7) {
    return (
      <div
        role="status"
        className="flex items-center gap-3 border-b border-warning/30 bg-warning/10 px-4 py-2.5 sm:px-5 lg:px-8"
      >
        <AlertTriangle size={16} className="shrink-0 text-warning" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-xs text-porcelain-ink sm:text-sm">
          <strong>
            Sua assinatura vence em {Math.max(diasFim, 0)} dia
            {diasFim === 1 ? "" : "s"}.
          </strong>{" "}
          <span className="text-text-subtle">Renove para manter o acesso.</span>
        </p>
        {cta}
      </div>
    );
  }

  return null;
}
