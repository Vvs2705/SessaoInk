/**
 * Mapeamento de APRESENTAÇÃO dos status de atendimento.
 *
 * O backend mantém 11 valores em `StatusOperacional` (enum e API intocados).
 * Para o tatuador isso é ruído: o que importa é saber em que ponto da vida do
 * atendimento ele está. Aqui os 11 viram 5 estados visuais.
 */

export type GrupoStatus =
  | "pendente"
  | "confirmado"
  | "em_sessao"
  | "concluido"
  | "cancelado";

type GrupoConfig = {
  label: string;
  /** Classes do chip (texto + fundo + borda), só tokens semânticos. */
  chip: string;
  /** Cor do ponto indicador (o estado nunca depende só de cor: há sempre texto). */
  dot: string;
};

export const GRUPOS_STATUS: Record<GrupoStatus, GrupoConfig> = {
  pendente: {
    label: "Pendente",
    chip: "text-warning bg-warning/10 border-warning/30",
    dot: "bg-warning",
  },
  confirmado: {
    label: "Confirmado",
    chip: "text-success bg-success/10 border-success/30",
    dot: "bg-success",
  },
  em_sessao: {
    label: "Em sessão",
    chip: "text-primary bg-primary/10 border-primary/30",
    dot: "bg-primary",
  },
  concluido: {
    label: "Concluído",
    chip: "text-status-finalizado bg-status-finalizado/10 border-status-finalizado/30",
    dot: "bg-status-finalizado",
  },
  cancelado: {
    label: "Cancelado",
    chip: "text-error-red bg-error-red/10 border-error-red/30",
    dot: "bg-error-red",
  },
};

const STATUS_PARA_GRUPO: Record<string, GrupoStatus> = {
  // Falta algo do estúdio ou do cliente para a sessão acontecer.
  SOLICITADO: "pendente",
  EM_ANALISE: "pendente",
  AGUARDANDO_SINAL: "pendente",
  REAGENDADO: "pendente",
  // Horário garantido (retoque marcado conta como horário garantido).
  CONFIRMADO: "confirmado",
  RETOQUE: "confirmado",
  EM_ATENDIMENTO: "em_sessao",
  FINALIZADO: "concluido",
  CANCELADO_CLIENTE: "cancelado",
  CANCELADO_ESTUDIO: "cancelado",
  NAO_COMPARECEU: "cancelado",
};

/** Status desconhecido (enum novo no backend) cai em "pendente": pede atenção. */
export function grupoDoStatus(statusOperacional: string): GrupoStatus {
  return STATUS_PARA_GRUPO[statusOperacional] ?? "pendente";
}

/** Rótulo detalhado, usado como `title` do chip para quem quiser o status cru. */
export const ROTULO_STATUS_DETALHADO: Record<string, string> = {
  SOLICITADO: "Solicitado",
  EM_ANALISE: "Em análise",
  AGUARDANDO_SINAL: "Aguardando sinal",
  CONFIRMADO: "Confirmado",
  EM_ATENDIMENTO: "Em atendimento",
  FINALIZADO: "Finalizado",
  REAGENDADO: "Reagendado",
  CANCELADO_CLIENTE: "Cancelado pelo cliente",
  CANCELADO_ESTUDIO: "Cancelado pelo estúdio",
  NAO_COMPARECEU: "Não compareceu",
  RETOQUE: "Retoque",
};
