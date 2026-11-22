import { cn } from "@/lib/utils";
import {
  GRUPOS_STATUS,
  ROTULO_STATUS_DETALHADO,
  grupoDoStatus,
  type GrupoStatus,
} from "@/lib/status-atendimento";

type StatusChipProps =
  | { statusOperacional: string; grupo?: never; className?: string }
  | { grupo: GrupoStatus; statusOperacional?: never; className?: string };

/**
 * Chip de status com 5 estados visuais (Pendente, Confirmado, Em sessão,
 * Concluído, Cancelado). Ponto + texto: o estado nunca depende só de cor.
 * Com `statusOperacional`, o status cru do backend vai no `title`.
 */
export function StatusChip({
  statusOperacional,
  grupo,
  className,
}: StatusChipProps) {
  const g = grupo ?? grupoDoStatus(statusOperacional ?? "");
  const cfg = GRUPOS_STATUS[g];
  const detalhe = statusOperacional
    ? (ROTULO_STATUS_DETALHADO[statusOperacional] ?? statusOperacional)
    : undefined;

  return (
    <span
      title={detalhe && detalhe !== cfg.label ? detalhe : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-xs font-medium",
        cfg.chip,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-pill", cfg.dot)} />
      {cfg.label}
    </span>
  );
}
