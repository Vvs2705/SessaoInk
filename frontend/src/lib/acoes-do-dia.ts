/**
 * Derivações de apresentação para a tela "Hoje".
 *
 * Tudo sai da lista que `GET /api/v1/atendimentos/` já devolve (a mesma da
 * página de Atendimentos e da Agenda: a agenda é `Atendimento.data_sessao`).
 * Nenhuma regra de negócio nova: só responde "o que eu faço agora?".
 */

import { grupoDoStatus } from "./status-atendimento";

export interface AtendimentoHoje {
  id: string;
  tipo: string;
  estilo: string | null;
  parte_corpo: string | null;
  tamanho_cm: string | null;
  status_operacional: string;
  status_financeiro: string;
  valor_total: number | null;
  valor_sinal: number | null;
  data_sessao: string | null;
  duracao_minutos?: number | null;
  cliente: {
    id: string;
    nome: string;
    telefone: string | null;
  } | null;
}

const MS_MINUTO = 60_000;
const MS_HORA = 60 * MS_MINUTO;

function mesmoDiaLocal(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function ativo(a: AtendimentoHoje): boolean {
  return grupoDoStatus(a.status_operacional) !== "cancelado";
}

function instante(iso: string | null): number {
  return iso ? new Date(iso).getTime() : Number.POSITIVE_INFINITY;
}

/** Sessões do dia (não canceladas), em ordem de horário. */
export function sessoesDoDia(
  lista: AtendimentoHoje[],
  agora: Date,
): AtendimentoHoje[] {
  return lista
    .filter((a) => {
      if (!a.data_sessao || !ativo(a)) return false;
      return mesmoDiaLocal(new Date(a.data_sessao), agora);
    })
    .sort((a, b) => instante(a.data_sessao) - instante(b.data_sessao));
}

/**
 * Sessão a destacar: a que está em andamento; senão a próxima que ainda não
 * passou e não está concluída/cancelada.
 */
export function proximaSessao(
  lista: AtendimentoHoje[],
  agora: Date,
): AtendimentoHoje | null {
  // Só vale "em sessão agora" para sessão de hoje (ou sem data): uma esquecida
  // nesse status em outro dia não pode ocupar o destaque para sempre.
  const emSessao = lista.find(
    (a) =>
      grupoDoStatus(a.status_operacional) === "em_sessao" &&
      (!a.data_sessao || mesmoDiaLocal(new Date(a.data_sessao), agora)),
  );
  if (emSessao) return emSessao;

  const futuras = lista
    .filter((a) => {
      if (!a.data_sessao) return false;
      const grupo = grupoDoStatus(a.status_operacional);
      if (grupo === "cancelado" || grupo === "concluido") return false;
      return instante(a.data_sessao) >= agora.getTime();
    })
    .sort((a, b) => instante(a.data_sessao) - instante(b.data_sessao));

  return futuras[0] ?? null;
}

export type TipoAcao = "confirmar_sinal" | "cobrar_sinal" | "responder";

export interface AcaoDoDia {
  /** Estável por atendimento + tipo (serve de `key`). */
  id: string;
  tipo: TipoAcao;
  atendimentoId: string;
  titulo: string;
  detalhe: string;
  clienteNome: string;
  telefone: string | null;
  /** Valor do sinal quando a ação é sobre sinal. */
  valor: number | null;
  /** Sessão marcada para as próximas 48 h: não dá para empurrar. */
  urgente: boolean;
  dataSessao: string | null;
}

const PRIORIDADE: Record<TipoAcao, number> = {
  confirmar_sinal: 0,
  cobrar_sinal: 1,
  responder: 2,
};

function descreverTattoo(a: AtendimentoHoje): string {
  const partes = [a.estilo, a.parte_corpo, a.tamanho_cm].filter(
    (p): p is string => Boolean(p),
  );
  return partes.length > 0 ? partes.join(" · ") : a.tipo;
}

/** Fila "Precisa de você": confirmar, cobrar sinal e responder. */
export function acoesDoDia(
  lista: AtendimentoHoje[],
  agora: Date,
): AcaoDoDia[] {
  const acoes: AcaoDoDia[] = [];

  for (const a of lista) {
    const clienteNome = a.cliente?.nome ?? "Cliente sem cadastro";
    const sinalRecebido =
      a.status_financeiro === "SINAL_PAGO" ||
      a.status_financeiro === "PAGO_TOTAL";

    let tipo: TipoAcao | null = null;
    let titulo = "";

    if (a.status_operacional === "SOLICITADO") {
      tipo = "responder";
      titulo = "Responder pedido de orçamento";
    } else if (a.status_operacional === "EM_ANALISE") {
      tipo = "responder";
      titulo = "Enviar valor ao cliente";
    } else if (a.status_operacional === "AGUARDANDO_SINAL") {
      tipo = sinalRecebido ? "confirmar_sinal" : "cobrar_sinal";
      titulo = sinalRecebido
        ? "Sinal pago: confirmar a sessão"
        : "Cobrar o sinal";
    }

    if (!tipo) continue;

    const quando = instante(a.data_sessao);
    const urgente =
      quando - agora.getTime() <= 48 * MS_HORA &&
      quando >= agora.getTime() - MS_HORA;

    acoes.push({
      id: `${a.id}:${tipo}`,
      tipo,
      atendimentoId: a.id,
      titulo,
      detalhe: descreverTattoo(a),
      clienteNome,
      telefone: a.cliente?.telefone ?? null,
      valor: tipo === "responder" ? null : a.valor_sinal,
      urgente,
      dataSessao: a.data_sessao,
    });
  }

  return acoes.sort((x, y) => {
    if (x.urgente !== y.urgente) return x.urgente ? -1 : 1;
    if (PRIORIDADE[x.tipo] !== PRIORIDADE[y.tipo]) {
      return PRIORIDADE[x.tipo] - PRIORIDADE[y.tipo];
    }
    const dx = instante(x.dataSessao);
    const dy = instante(y.dataSessao);
    if (dx === dy) return 0;
    return dx < dy ? -1 : 1;
  });
}

/** Link `wa.me` com mensagem pronta. Sem telefone utilizável, devolve null. */
export function linkWhatsApp(
  telefone: string | null,
  mensagem: string,
): string | null {
  if (!telefone) return null;
  // "011 9..." (0 de operadora/tronco na frente) vira DDD + número.
  let digitos = telefone.replace(/\D/g, "").replace(/^0+/, "");
  if (digitos.length < 10) return null;
  // Número nacional (DDD + número): assume Brasil.
  if (digitos.length <= 11) digitos = `55${digitos}`;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensagem)}`;
}

/**
 * Alertas do backend que a fila "Precisa de você" já cobre a partir dos
 * atendimentos. SINAL_PENDENTE fica de fora de propósito: ele vem dos
 * lançamentos do financeiro (sinal vencido de sessão já confirmada ou sem
 * atendimento vinculado), que a fila não enxerga.
 */
const ALERTAS_DERIVADOS = new Set(["ORCAMENTO_PARADO"]);

/** Alertas a mostrar. Se a lista de atendimentos falhou, mostra todos. */
export function alertasVisiveis<T extends { tipo: string }>(
  alertas: T[],
  temAtendimentos: boolean,
): T[] {
  if (!temAtendimentos) return alertas;
  return alertas.filter((a) => !ALERTAS_DERIVADOS.has(a.tipo));
}

/** Duração prevista: "20 min", "1 h", "1 h 30 min". */
export function formatDuracao(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const min = Math.round(minutos % 60);
  if (h === 0) return `${min} min`;
  return min === 0 ? `${h} h` : `${h} h ${min} min`;
}

/** "42 min", "2 h 10 min", "3 dias". Passado ou menos de 1 min: "agora". */
export function contagemRegressiva(alvo: Date, agora: Date): string {
  const ms = alvo.getTime() - agora.getTime();
  if (ms < MS_MINUTO) return "agora";

  const minutos = Math.round(ms / MS_MINUTO);
  if (minutos < 60) return `${minutos} min`;

  if (ms < 24 * MS_HORA) {
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
  }

  const dias = Math.round(ms / (24 * MS_HORA));
  return dias === 1 ? "1 dia" : `${dias} dias`;
}

export function saudacao(agora: Date): string {
  const h = agora.getHours();
  if (h < 5) return "Boa noite";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function primeiroNome(nomeCompleto: string | undefined): string {
  return nomeCompleto?.trim().split(/\s+/)[0] ?? "";
}
