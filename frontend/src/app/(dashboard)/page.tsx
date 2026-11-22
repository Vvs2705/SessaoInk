"use client";

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Check,
  ClipboardList,
  Copy,
  DollarSign,
  ExternalLink,
  Inbox,
  MessageCircle,
  Package,
  Percent,
  Plus,
  RefreshCw,
  Users,
  Wallet,
} from "lucide-react";

import { CountUp } from "@/components/CountUp";
import { StatusChip } from "@/components/StatusChip";
import {
  acoesDoDia,
  contagemRegressiva,
  linkWhatsApp,
  primeiroNome,
  proximaSessao,
  saudacao,
  sessoesDoDia,
  type AcaoDoDia,
  type AtendimentoHoje,
} from "@/lib/acoes-do-dia";
import { api } from "@/lib/api/client";
import { grupoDoStatus } from "@/lib/status-atendimento";
import { useAtendimentos } from "@/lib/useAtendimentos";
import { cn, formatCurrency } from "@/lib/utils";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  tipo: "ADMIN" | "ARTISTA" | "RECEPCIONISTA";
  estudio_id: string;
}

interface Estudio {
  slug?: string | null;
}

interface DashboardResumo {
  periodo: { inicio: string; fim: string };
  financeiro: {
    entradas_pagas: number;
    entradas_pendentes: number;
    saidas_pagas: number;
    saidas_pendentes: number;
    saldo_realizado: number;
    saldo_previsto: number;
    sinais_pagos: number;
    sinais_pendentes: number;
    comissoes_pagas: number;
    comissoes_pendentes: number;
    lucro_estimado: number;
    ticket_medio: number;
  };
  operacional: {
    orcamentos_pendentes: number;
    sessoes_hoje: number;
    sessoes_sete_dias: number;
    aguardando_sinal: number;
    clientes_novos: number;
    conversao_orcamento_sessao: number;
  };
  graficos: {
    por_categoria: Array<{ categoria: string; valor: number }>;
    por_artista: Array<{ artista_nome: string; valor: number }>;
    por_metodo: Array<{ metodo: string; valor: number }>;
    fluxo_diario: Array<{ dia: string; entradas: number; saidas: number }>;
  };
  alertas: Array<{
    tipo: string;
    mensagem: string;
    link: string | null;
  }>;
}

const CARD = "rounded-lg border border-border bg-card";
const BTN_PRIMARY =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover";
const BTN_GHOST =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-transparent px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary";
const BTN_SMALL =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-sm border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary";

// Alertas do backend que a fila "Precisa de você" já deriva dos atendimentos.
const ALERTAS_DERIVADOS = new Set(["ORCAMENTO_PARADO", "SINAL_PENDENTE"]);

function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDia(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function mesmoDia(iso: string, agora: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === agora.getFullYear() &&
    d.getMonth() === agora.getMonth() &&
    d.getDate() === agora.getDate()
  );
}

function formatBRL(n: number): string {
  return formatCurrency(Math.round(n * 100) / 100);
}

const FIN_ROTULO: Record<string, { label: string; cls: string }> = {
  PENDENTE: { label: "Sinal pendente", cls: "text-warning" },
  SINAL_PAGO: { label: "Sinal pago", cls: "text-success" },
  PAGO_TOTAL: { label: "Pago por completo", cls: "text-success" },
  ESTORNADO: { label: "Estornado", cls: "text-error-red" },
};

// ---------------------------------------------------------------------------
// Próxima sessão
// ---------------------------------------------------------------------------

function ProximaSessaoCard({
  sessao,
  agora,
  carregando,
  erro,
  onTentarNovamente,
}: {
  sessao: AtendimentoHoje | null;
  agora: Date;
  carregando: boolean;
  erro: boolean;
  onTentarNovamente: () => void;
}) {
  if (carregando) {
    return (
      <section
        aria-label="Próxima sessão"
        className={cn(CARD, "h-64 animate-pulse p-6 lg:col-span-3")}
      />
    );
  }

  if (erro) {
    return (
      <section
        aria-label="Próxima sessão"
        className={cn(CARD, "flex flex-col justify-center gap-3 p-6 lg:col-span-3")}
      >
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          Próxima sessão
        </p>
        <h2 className="text-2xl text-foreground">Não foi possível carregar a agenda</h2>
        <div>
          <button type="button" onClick={onTentarNovamente} className={BTN_GHOST}>
            <RefreshCw size={16} aria-hidden="true" />
            Tentar de novo
          </button>
        </div>
      </section>
    );
  }

  if (!sessao || !sessao.data_sessao) {
    return (
      <section
        aria-label="Próxima sessão"
        className={cn(CARD, "flex flex-col justify-center gap-3 p-6 lg:col-span-3")}
      >
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          Próxima sessão
        </p>
        <h2 className="text-2xl text-foreground">Nenhuma sessão marcada</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Quando um atendimento tiver data e horário, ele aparece aqui com
          contagem regressiva e o estado do sinal.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link href="/atendimentos" className={BTN_PRIMARY}>
            <Plus size={16} aria-hidden="true" />
            Novo atendimento
          </Link>
          <Link href="/agenda" className={BTN_GHOST}>
            Abrir agenda
          </Link>
        </div>
      </section>
    );
  }

  const quando = new Date(sessao.data_sessao);
  const emAndamento = grupoDoStatus(sessao.status_operacional) === "em_sessao";
  const hoje = mesmoDia(sessao.data_sessao, agora);
  const sinal = FIN_ROTULO[sessao.status_financeiro];
  const nome = sessao.cliente?.nome ?? "Cliente sem cadastro";
  const whatsapp = linkWhatsApp(
    sessao.cliente?.telefone ?? null,
    `Oi, ${primeiroNome(nome)}! Passando para confirmar a sua sessão ${
      hoje ? "de hoje" : `em ${formatDia(sessao.data_sessao)}`
    } às ${formatHora(sessao.data_sessao)}.`,
  );

  const chips = [
    ["Estilo", sessao.estilo],
    ["Local", sessao.parte_corpo],
    ["Tamanho", sessao.tamanho_cm],
  ].filter((c): c is [string, string] => Boolean(c[1]));

  return (
    <section
      aria-label="Próxima sessão"
      className={cn(CARD, "grid grid-cols-1 gap-6 p-6 sm:grid-cols-[minmax(0,1fr)_auto] lg:col-span-3")}
    >
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-mono text-xs uppercase tracking-wide text-primary">
            {emAndamento ? "Em sessão agora" : "Próxima sessão"}
          </p>
          <StatusChip statusOperacional={sessao.status_operacional} />
        </div>

        <div>
          <h2 className="truncate text-3xl text-foreground">{nome}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {hoje ? "Hoje" : formatDia(sessao.data_sessao)} às{" "}
            {formatHora(sessao.data_sessao)}
            {sessao.duracao_minutos
              ? ` · ${Math.round(sessao.duracao_minutos / 60)} h previstas`
              : ""}
          </p>
        </div>

        {chips.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {chips.map(([rotulo, valor]) => (
              <li
                key={rotulo}
                className="rounded-pill border border-border px-3 py-1 text-sm text-foreground"
              >
                <span className="mr-1.5 font-mono text-xs uppercase text-muted-foreground">
                  {rotulo}
                </span>
                {valor}
              </li>
            ))}
          </ul>
        )}

        <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Sinal</dt>
            <dd className={cn("font-medium", sinal?.cls ?? "text-foreground")}>
              {sinal?.label ?? sessao.status_financeiro}
              {sessao.valor_sinal ? ` · ${formatBRL(sessao.valor_sinal)}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Valor combinado</dt>
            <dd className="font-medium text-foreground">
              {sessao.valor_total ? formatBRL(sessao.valor_total) : "A definir"}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          <Link href={`/atendimentos/${sessao.id}`} className={BTN_PRIMARY}>
            Abrir atendimento
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noreferrer"
              className={BTN_GHOST}
            >
              <MessageCircle size={16} aria-hidden="true" />
              Falar com o cliente
            </a>
          )}
        </div>
      </div>

      {!emAndamento && (
        <div className="flex flex-col items-start justify-center sm:items-end sm:text-right">
          <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            Começa em
          </p>
          <p className="font-display text-5xl leading-none text-foreground">
            {contagemRegressiva(quando, agora)}
          </p>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Fila "Precisa de você"
// ---------------------------------------------------------------------------

const ICONE_ACAO: Record<AcaoDoDia["tipo"], React.ElementType> = {
  confirmar_sinal: Check,
  cobrar_sinal: Wallet,
  responder: Inbox,
};

function mensagemWhatsApp(acao: AcaoDoDia): string {
  const nome = primeiroNome(acao.clienteNome);
  if (acao.tipo === "cobrar_sinal") {
    return `Oi, ${nome}! Passando para lembrar do sinal${
      acao.valor ? ` de ${formatBRL(acao.valor)}` : ""
    } que garante o seu horário.`;
  }
  return `Oi, ${nome}! Recebi o seu pedido de orçamento e já te respondo com os detalhes.`;
}

function iconeDoAlerta(tipo: string): React.ElementType {
  switch (tipo) {
    case "ESTOQUE_BAIXO":
      return Package;
    case "SEM_PAGAMENTO":
      return DollarSign;
    case "COMISSAO_PENDENTE":
      return Percent;
    case "SINAL_PENDENTE":
      return Calendar;
    case "ORCAMENTO_PARADO":
      return ClipboardList;
    default:
      return AlertCircle;
  }
}

const LIMITE_FILA = 5;

function FilaDeAcoes({
  acoes,
  alertas,
  carregando,
  erro,
  onTentarNovamente,
}: {
  acoes: AcaoDoDia[];
  alertas: DashboardResumo["alertas"];
  carregando: boolean;
  erro: boolean;
  onTentarNovamente: () => void;
}) {
  const total = acoes.length + alertas.length;
  const visiveis = acoes.slice(0, LIMITE_FILA);
  const alertasVisiveis = alertas.slice(0, Math.max(0, LIMITE_FILA - visiveis.length));

  return (
    <section
      aria-label="Precisa de você"
      className={cn(CARD, "flex flex-col p-5 lg:col-span-2")}
    >
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg text-foreground">Precisa de você</h2>
        {!carregando && total > 0 && (
          <span className="rounded-pill bg-primary px-2 py-0.5 font-mono text-xs font-medium text-primary-foreground">
            {total}
          </span>
        )}
      </div>

      {carregando && (
        <div className="space-y-3 animate-pulse" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-md bg-secondary" />
          ))}
        </div>
      )}

      {!carregando && erro && (
        <div className="flex flex-1 flex-col items-start justify-center gap-3 py-6">
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar os atendimentos agora.
          </p>
          <button type="button" onClick={onTentarNovamente} className={BTN_SMALL}>
            <RefreshCw size={14} aria-hidden="true" />
            Tentar de novo
          </button>
        </div>
      )}

      {!carregando && !erro && total === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-pill bg-success/10 text-success">
            <Check size={20} aria-hidden="true" />
          </span>
          <p className="text-sm font-medium text-foreground">Tudo em dia</p>
          <p className="text-xs text-muted-foreground">
            Sem pedidos para responder nem sinais para cobrar.
          </p>
        </div>
      )}

      {!carregando && !erro && total > 0 && (
        <ul className="divide-y divide-border">
          {visiveis.map((acao) => {
            const Icone = ICONE_ACAO[acao.tipo];
            const whatsapp =
              acao.tipo === "confirmar_sinal"
                ? null
                : linkWhatsApp(acao.telefone, mensagemWhatsApp(acao));
            return (
              <li key={acao.id} className="flex gap-3 py-3 first:pt-0">
                <span
                  className={cn(
                    "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-sm",
                    acao.tipo === "confirmar_sinal"
                      ? "bg-success/10 text-success"
                      : acao.tipo === "cobrar_sinal"
                        ? "bg-warning/10 text-warning"
                        : "bg-primary/10 text-primary",
                  )}
                >
                  <Icone size={16} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {acao.titulo}
                    </p>
                    {acao.valor ? (
                      <span className="shrink-0 font-mono text-xs text-foreground">
                        {formatBRL(acao.valor)}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {acao.clienteNome} · {acao.detalhe}
                    {acao.dataSessao
                      ? ` · sessão ${formatDia(acao.dataSessao)}`
                      : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link href={`/atendimentos/${acao.atendimentoId}`} className={BTN_SMALL}>
                      {acao.tipo === "confirmar_sinal"
                        ? "Conferir e confirmar"
                        : acao.tipo === "cobrar_sinal"
                          ? "Ver atendimento"
                          : "Responder"}
                    </Link>
                    {whatsapp && (
                      <a
                        href={whatsapp}
                        target="_blank"
                        rel="noreferrer"
                        className={BTN_SMALL}
                      >
                        <MessageCircle size={14} aria-hidden="true" />
                        WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              </li>
            );
          })}

          {alertasVisiveis.map((alerta, idx) => {
            const Icone = iconeDoAlerta(alerta.tipo);
            const conteudo = (
              <>
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-warning/10 text-warning">
                  <Icone size={16} aria-hidden="true" />
                </span>
                <p className="flex-1 text-sm text-foreground">{alerta.mensagem}</p>
                {alerta.link && (
                  <ArrowRight
                    size={14}
                    aria-hidden="true"
                    className="mt-1.5 shrink-0 text-muted-foreground"
                  />
                )}
              </>
            );
            return (
              <li key={`${alerta.tipo}-${idx}`} className="py-3">
                {alerta.link ? (
                  <Link href={alerta.link} className="flex gap-3 hover:opacity-90">
                    {conteudo}
                  </Link>
                ) : (
                  <div className="flex gap-3">{conteudo}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!carregando && !erro && total > LIMITE_FILA && (
        <Link
          href="/atendimentos"
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Ver todos ({total}) <ArrowRight size={14} aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Agenda do dia
// ---------------------------------------------------------------------------

function AgendaDoDia({
  sessoes,
  destaqueId,
  carregando,
}: {
  sessoes: AtendimentoHoje[];
  destaqueId: string | null;
  carregando: boolean;
}) {
  const concluidas = sessoes.filter(
    (s) => grupoDoStatus(s.status_operacional) === "concluido",
  ).length;

  return (
    <section
      aria-label="Agenda de hoje"
      className={cn(CARD, "p-5 lg:col-span-3")}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg text-foreground">Agenda de hoje</h2>
        <div className="flex items-center gap-4">
          {sessoes.length > 0 && (
            <span className="font-mono text-xs text-muted-foreground">
              {concluidas} de {sessoes.length} concluídas
            </span>
          )}
          <Link
            href="/agenda"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Ver agenda <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {carregando ? (
        <div className="space-y-2 animate-pulse" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-md bg-secondary" />
          ))}
        </div>
      ) : sessoes.length === 0 ? (
        <p className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          Nenhuma sessão hoje. Dia livre para desenhar.
        </p>
      ) : (
        <ul className="space-y-2">
          {sessoes.map((s) => {
            const fim =
              s.data_sessao && s.duracao_minutos
                ? formatHora(
                    new Date(
                      new Date(s.data_sessao).getTime() + s.duracao_minutos * 60_000,
                    ).toISOString(),
                  )
                : null;
            const destaque = s.id === destaqueId;
            const concluida = grupoDoStatus(s.status_operacional) === "concluido";
            return (
              <li key={s.id}>
                <Link
                  href={`/atendimentos/${s.id}`}
                  className={cn(
                    "flex items-center gap-4 rounded-md border px-4 py-3 transition-colors hover:bg-secondary",
                    destaque
                      ? "border-primary/40 bg-primary/5"
                      : "border-border",
                    concluida && "opacity-70",
                  )}
                >
                  <div className="w-16 shrink-0 font-mono text-sm text-foreground">
                    {s.data_sessao ? formatHora(s.data_sessao) : "--:--"}
                    {fim && (
                      <span className="block text-xs text-muted-foreground">
                        até {fim}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {s.cliente?.nome ?? "Cliente sem cadastro"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[s.estilo, s.parte_corpo, s.tamanho_cm]
                        .filter(Boolean)
                        .join(" · ") || s.tipo}
                    </p>
                  </div>
                  <StatusChip statusOperacional={s.status_operacional} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Portal público
// ---------------------------------------------------------------------------

function PortalCard({ portalUrl }: { portalUrl: string | null }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    if (!portalUrl) return;
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Clipboard bloqueado pelo navegador: o link segue visível para copiar à mão.
    }
  };

  return (
    <section
      aria-label="Portal do cliente"
      className={cn(CARD, "flex flex-col gap-3 p-5 lg:col-span-2")}
    >
      <div>
        <h2 className="text-lg text-foreground">Portal do cliente</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Divulgue este link no Instagram para receber pedidos de orçamento já
          organizados na fila acima.
        </p>
      </div>
      {portalUrl ? (
        <p className="truncate rounded-sm border border-border bg-secondary px-3 py-2 font-mono text-xs text-primary">
          {portalUrl}
        </p>
      ) : (
        <div className="h-8 animate-pulse rounded-sm bg-secondary" />
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copiar}
          disabled={!portalUrl}
          className={cn(BTN_PRIMARY, "disabled:opacity-40")}
        >
          <Copy size={14} aria-hidden="true" />
          <span aria-live="polite">{copiado ? "Copiado!" : "Copiar link"}</span>
        </button>
        {portalUrl && (
          <a href={portalUrl} target="_blank" rel="noreferrer" className={BTN_GHOST}>
            <ExternalLink size={14} aria-hidden="true" />
            Ver portal
          </a>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Números do período
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  format,
  icon: Icon,
  subtitle,
}: {
  label: string;
  value: number;
  format: (n: number) => string;
  icon: React.ElementType;
  subtitle?: string;
}) {
  return (
    <div className={cn(CARD, "flex items-start justify-between gap-3 p-5")}>
      <div className="min-w-0">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 font-display text-3xl text-foreground">
          <CountUp value={value} format={format} />
        </p>
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <Icon size={18} aria-hidden="true" className="mt-1 shrink-0 text-muted-foreground" />
    </div>
  );
}

function DashboardSkeleton() {
  // Sem padding/max-w: o (dashboard)/layout.tsx já provê padding lateral,
  // largura máxima e centralização.
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Carregando painel">
      <div className="space-y-2">
        <div className="h-4 w-40 rounded-sm bg-secondary" />
        <div className="h-9 w-72 rounded-sm bg-secondary" />
        <div className="h-4 w-80 rounded-sm bg-secondary" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="h-64 rounded-lg bg-card lg:col-span-3" />
        <div className="h-64 rounded-lg bg-card lg:col-span-2" />
      </div>
      <div className="h-48 rounded-lg bg-card" />
    </div>
  );
}

export default function DashboardPage() {
  // Período dos números (padrão: mês corrente).
  const defaultInicio = new Date();
  defaultInicio.setDate(1);
  const defaultFim = new Date(
    defaultInicio.getFullYear(),
    defaultInicio.getMonth() + 1,
    0,
  );

  const [inicio, setInicio] = useState(defaultInicio.toISOString().split("T")[0]);
  const [fim, setFim] = useState(defaultFim.toISOString().split("T")[0]);

  // Relógio da tela: a contagem regressiva e "próxima sessão" avançam sozinhas.
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setAgora(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const { data: usuario, isLoading: loadUsuario } = useQuery<Usuario>({
    queryKey: ["auth-me"],
    queryFn: () => api.get<Usuario>("/api/v1/auth/me"),
  });

  const { data: estudio } = useQuery<Estudio>({
    queryKey: ["estudio"],
    queryFn: () => api.get<Estudio>("/api/v1/estudio/"),
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: dashboard,
    isLoading: loadResumo,
    isFetching: fetchingResumo,
    refetch,
  } = useQuery<DashboardResumo>({
    queryKey: ["dashboard-resumo", inicio, fim],
    queryFn: () => api.get(`/api/v1/dashboard/resumo?inicio=${inicio}&fim=${fim}`),
    refetchOnMount: true,
    // Troca de período mantém a tela (e os campos de data) montada.
    placeholderData: keepPreviousData,
  });

  const {
    data: atendimentos,
    isLoading: loadAtendimentos,
    isError: erroAtendimentos,
    refetch: refetchAtendimentos,
  } = useAtendimentos();

  const sessoesHoje = useMemo(
    () => sessoesDoDia(atendimentos ?? [], agora),
    [atendimentos, agora],
  );
  const proxima = useMemo(
    () => proximaSessao(atendimentos ?? [], agora),
    [atendimentos, agora],
  );
  const acoes = useMemo(
    () => acoesDoDia(atendimentos ?? [], agora),
    [atendimentos, agora],
  );

  if (loadUsuario || (loadResumo && !dashboard)) {
    return <DashboardSkeleton />;
  }

  const showFinancials = usuario?.tipo === "ADMIN";
  const portalUrl = estudio?.slug
    ? `https://sessao-ink.vercel.app/${estudio.slug}`
    : null;

  // Se a lista de atendimentos falhou, os alertas do backend cobrem o buraco.
  const alertas = (dashboard?.alertas ?? []).filter(
    (a) => !atendimentos || !ALERTAS_DERIVADOS.has(a.tipo),
  );
  const totalAcoes = acoes.length + alertas.length;

  const dataExtenso = agora.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const nome = primeiroNome(usuario?.nome);

  return (
    <div className="space-y-6">
      {/* 1. Cabeçalho: saudação + resumo do que importa agora */}
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {dataExtenso}
          </p>
          <h1 className="mt-1 text-3xl text-foreground sm:text-4xl">
            {saudacao(agora)}
            {nome ? `, ${nome}` : ""}.
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loadAtendimentos
              ? "Carregando o dia…"
              : `${sessoesHoje.length} ${
                  sessoesHoje.length === 1 ? "sessão" : "sessões"
                } hoje · ${
                  totalAcoes === 0
                    ? "nada esperando por você"
                    : `${totalAcoes} ${
                        totalAcoes === 1 ? "coisa esperando" : "coisas esperando"
                      } por você`
                }.`}
          </p>
        </div>
        <Link href="/atendimentos" className={cn(BTN_PRIMARY, "self-start md:self-auto")}>
          <Plus size={16} aria-hidden="true" />
          Novo atendimento
        </Link>
      </header>

      {/* 2. Próxima sessão + fila de ações */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <ProximaSessaoCard
          sessao={proxima}
          agora={agora}
          carregando={loadAtendimentos}
          erro={erroAtendimentos && !atendimentos}
          onTentarNovamente={() => void refetchAtendimentos()}
        />
        <FilaDeAcoes
          acoes={acoes}
          alertas={alertas}
          carregando={loadAtendimentos && !atendimentos}
          erro={erroAtendimentos && !atendimentos}
          onTentarNovamente={() => void refetchAtendimentos()}
        />
      </div>

      {/* 3. Agenda do dia + portal */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <AgendaDoDia
          sessoes={sessoesHoje}
          destaqueId={proxima?.id ?? null}
          carregando={loadAtendimentos}
        />
        <PortalCard portalUrl={portalUrl} />
      </div>

      {/* 4. Números do período (por último: informam, não pedem ação) */}
      <section aria-label="Números do período" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg text-foreground">Números do período</h2>
            <p className="text-sm text-muted-foreground">
              Desempenho do estúdio entre as datas escolhidas.
            </p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 sm:flex-none">
              <label className="sr-only" htmlFor="periodo-inicio">
                Início do período
              </label>
              <input
                id="periodo-inicio"
                type="date"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                className="min-w-0 flex-1 bg-transparent px-1 text-xs text-foreground outline-none sm:flex-none"
              />
              <span className="shrink-0 text-xs text-muted-foreground">até</span>
              <label className="sr-only" htmlFor="periodo-fim">
                Fim do período
              </label>
              <input
                id="periodo-fim"
                type="date"
                value={fim}
                onChange={(e) => setFim(e.target.value)}
                className="min-w-0 flex-1 bg-transparent px-1 text-xs text-foreground outline-none sm:flex-none"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                void refetch();
                void refetchAtendimentos();
              }}
              aria-label="Atualizar dados"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <RefreshCw
                size={16}
                aria-hidden="true"
                className={fetchingResumo ? "animate-spin" : ""}
              />
            </button>
          </div>
        </div>

        <div
          className={cn(
            "grid gap-4",
            showFinancials
              ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
              : "grid-cols-1 sm:grid-cols-3",
          )}
        >
          {showFinancials && (
            <StatCard
              label="Saldo realizado"
              value={dashboard?.financeiro.saldo_realizado ?? 0}
              format={formatBRL}
              icon={Wallet}
              subtitle={`Lucro estimado: ${formatCurrency(dashboard?.financeiro.lucro_estimado ?? 0)}`}
            />
          )}
          <StatCard
            label="Sessões em 7 dias"
            value={dashboard?.operacional.sessoes_sete_dias ?? 0}
            format={(n) => String(Math.round(n))}
            icon={Calendar}
            subtitle={`Hoje: ${dashboard?.operacional.sessoes_hoje ?? 0} · aguardando sinal: ${dashboard?.operacional.aguardando_sinal ?? 0}`}
          />
          <StatCard
            label="Conversão de orçamentos"
            value={dashboard?.operacional.conversao_orcamento_sessao ?? 0}
            format={(n) => `${Math.round(n)}%`}
            icon={Percent}
            subtitle={`Orçamentos pendentes: ${dashboard?.operacional.orcamentos_pendentes ?? 0}`}
          />
          <StatCard
            label="Clientes novos"
            value={dashboard?.operacional.clientes_novos ?? 0}
            format={(n) => String(Math.round(n))}
            icon={Users}
            subtitle={
              showFinancials
                ? `Ticket médio: ${formatCurrency(dashboard?.financeiro.ticket_medio ?? 0)}`
                : "Total no período"
            }
          />
        </div>

        {showFinancials && dashboard && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className={cn(CARD, "space-y-4 p-5 lg:col-span-2")}>
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-sm font-medium text-foreground">
                    Fluxo diário no período
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Entradas e saídas liquidadas
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-success" aria-hidden="true" />
                    Entradas
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-error-red" aria-hidden="true" />
                    Saídas
                  </span>
                </div>
                <Link href="/financeiro" className="text-xs font-medium text-primary hover:underline">
                  Ir para financeiro
                </Link>
              </div>
              {dashboard.graficos.fluxo_diario.length === 0 ? (
                <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                  Sem lançamentos no período
                </div>
              ) : (
                /* Rolagem horizontal DENTRO do card: períodos longos não
                   estouram a viewport. */
                <div className="no-scrollbar overflow-x-auto pt-4">
                  <div
                    className="flex h-48 min-w-full items-end gap-1"
                    role="img"
                    aria-label={`Gráfico de fluxo diário: ${dashboard.graficos.fluxo_diario.length} dia(s) com entradas e saídas liquidadas no período.`}
                  >
                    {(() => {
                      const maxVal = Math.max(
                        ...dashboard.graficos.fluxo_diario.map((fd) =>
                          Math.max(fd.entradas, fd.saidas),
                        ),
                        1,
                      );
                      return dashboard.graficos.fluxo_diario.map((d, idx) => {
                        const entPct = (d.entradas / maxVal) * 100;
                        const saiPct = (d.saidas / maxVal) * 100;
                        return (
                          <div
                            key={idx}
                            className="relative flex h-full flex-col items-center justify-end"
                            style={{ flex: "1 0 auto", minWidth: 18 }}
                          >
                            <div className="flex h-full w-full items-end justify-center gap-0.5" aria-hidden="true">
                              <div
                                style={{ height: `${entPct}%` }}
                                className="w-2 rounded-t-xs bg-success transition-colors hover:bg-success-hover"
                                title={`Entrada: ${formatCurrency(d.entradas)}`}
                              />
                              <div
                                style={{ height: `${saiPct}%` }}
                                className="w-2 rounded-t-xs bg-error-red transition-colors hover:bg-error-hover"
                                title={`Saída: ${formatCurrency(d.saidas)}`}
                              />
                            </div>
                            <span
                              className="mt-2 block origin-top-left -rotate-45 text-xs text-muted-foreground"
                              aria-hidden="true"
                            >
                              {d.dia.split("-")[2]}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className={cn(CARD, "flex flex-col space-y-4 p-5")}>
              <div>
                <h3 className="text-sm font-medium text-foreground">
                  Faturamento por artista
                </h3>
                <p className="text-xs text-muted-foreground">
                  Proporção das entradas pagas no período
                </p>
              </div>
              <div className="flex flex-1 flex-col justify-center space-y-3">
                {dashboard.graficos.por_artista.length === 0 ? (
                  <p className="my-10 text-center text-xs text-muted-foreground">
                    Nenhuma comissão ou entrada processada
                  </p>
                ) : (
                  dashboard.graficos.por_artista.map((art, idx) => {
                    const total = dashboard.financeiro.entradas_pagas || 1;
                    const pct = (art.valor / total) * 100;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium text-foreground">
                          <span className="flex items-center gap-1">
                            <Users size={12} aria-hidden="true" className="text-muted-foreground" />
                            {art.artista_nome}
                          </span>
                          <span className="font-mono">{formatCurrency(art.valor)}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-pill border border-border bg-ink-night" aria-hidden="true">
                          <div style={{ width: `${pct}%` }} className="h-full rounded-pill bg-primary" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
