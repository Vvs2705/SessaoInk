"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  ClipboardList,
  Users,
  Wallet,
  TrendingUp,
  AlertCircle,
  Copy,
  ExternalLink,
  ArrowRight,
  TrendingDown,
  Percent,
  Plus,
  RefreshCw,
  Package,
  DollarSign,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { formatCurrency, cn } from "@/lib/utils";
import Link from "next/link";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  tipo: "ADMIN" | "ARTISTA" | "RECEPCIONISTA";
  estudio_id: string;
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

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  loading,
  subtitle,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  loading?: boolean;
  subtitle?: string;
}) {
  return (
    <div className="bg-ink-bg border border-mist-line rounded-[18px] p-5 flex items-center justify-between shadow-[0_18px_50px_rgba(0,0,0,0.35)] hover:border-teal-ink/20 transition-all">
      <div>
        <p className="text-[11px] text-text-subtle font-bold uppercase tracking-wider mb-1">{label}</p>
        {loading ? (
          <div className="h-8 w-24 bg-surface-raised animate-pulse rounded" />
        ) : (
          <p className="text-2xl font-extrabold text-porcelain-ink">{value}</p>
        )}
        {subtitle && <p className="text-[10px] text-text-subtle mt-1">{subtitle}</p>}
      </div>
      <div className="p-3 bg-surface-raised rounded-[12px] border border-mist-line">
        <Icon size={20} className={color} />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  // Sem p-6/max-w-7xl: o (dashboard)/layout.tsx já provê padding lateral,
  // largura máxima e centralização. Repetir aqui dobrava o padding no mobile.
  return (
    <div className="space-y-5 sm:space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-surface-raised rounded" />
          <div className="h-4 w-72 bg-surface-raised rounded" />
        </div>
        <div className="h-10 w-44 bg-surface-raised rounded" />
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-ink-bg border border-mist-line rounded-[18px] p-5 flex items-center justify-between h-28">
            <div className="space-y-2 flex-1">
              <div className="h-3 w-20 bg-surface-raised rounded" />
              <div className="h-8 w-24 bg-surface-raised rounded" />
              <div className="h-3 w-32 bg-surface-raised rounded" />
            </div>
            <div className="w-10 h-10 bg-surface-raised rounded-[12px] border border-mist-line" />
          </div>
        ))}
      </div>

      {/* Client Portal Link Skeleton */}
      <div className="bg-ink-bg border border-mist-line rounded-[18px] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 h-24">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-surface-raised rounded-[12px]" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-surface-raised rounded" />
            <div className="h-3 w-64 bg-surface-raised rounded" />
          </div>
        </div>
        <div className="h-9 w-24 bg-surface-raised rounded-[12px]" />
      </div>

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-ink-bg border border-mist-line rounded-[18px] p-5 h-64 lg:col-span-2 space-y-4">
          <div className="h-4 w-32 bg-surface-raised rounded" />
          <div className="h-36 bg-surface-raised/40 rounded-[12px]" />
        </div>
        <div className="bg-ink-bg border border-mist-line rounded-[18px] p-5 h-64 space-y-4">
          <div className="h-4 w-32 bg-surface-raised rounded" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-surface-raised rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [copiado, setCopiado] = useState(false);

  // Dynamic date range: current month
  const defaultInicio = new Date();
  defaultInicio.setDate(1);
  const defaultFim = new Date(defaultInicio.getFullYear(), defaultInicio.getMonth() + 1, 0);

  const [inicio, setInicio] = useState(defaultInicio.toISOString().split("T")[0]);
  const [fim, setFim] = useState(defaultFim.toISOString().split("T")[0]);

  // Auth User Query
  const { data: usuario, isLoading: loadUsuario } = useQuery<Usuario>({
    queryKey: ["auth-me"],
    queryFn: () => api.get<Usuario>("/api/v1/auth/me"),
  });

  const { data: estudio } = useQuery<any>({
    queryKey: ["estudio"],
    queryFn: () => api.get("/api/v1/estudio/"),
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: dashboard,
    isLoading: loadResumo,
    refetch,
  } = useQuery<DashboardResumo>({
    queryKey: ["dashboard-resumo", inicio, fim],
    queryFn: () => api.get(`/api/v1/dashboard/resumo?inicio=${inicio}&fim=${fim}`),
    refetchOnMount: true,
  });

  if (loadUsuario || loadResumo) {
    return <DashboardSkeleton />;
  }

  const showFinancials = usuario?.tipo === "ADMIN";

  const portalUrl = estudio?.slug ? `https://sessao-ink.vercel.app/${estudio.slug}` : null;

  const handleCopiarPortal = () => {
    if (!portalUrl) return;
    navigator.clipboard.writeText(portalUrl);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const getAlertaIcon = (tipo: string) => {
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
  };

  const getAlertaColor = (tipo: string) => {
    switch (tipo) {
      case "ESTOQUE_BAIXO":
        return "text-error-red bg-error-red/10 border-error-red/20"; // Red
      case "SEM_PAGAMENTO":
        return "text-warning bg-warning/10 border-warning/20"; // Yellow
      case "COMISSAO_PENDENTE":
        return "text-[#A78BFA] bg-[#A78BFA]/10 border-[#A78BFA]/20"; // Purple
      case "SINAL_PENDENTE":
      case "ORCAMENTO_PARADO":
        return "text-info bg-info/10 border-info/20"; // Blue
      default:
        return "text-warning bg-warning/10 border-warning/20"; // Yellow
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-porcelain-ink sm:text-3xl">Painel Inicial</h1>
          <p className="mt-0.5 text-sm text-text-subtle">Desempenho operacional, faturamento e alertas do estúdio</p>
        </div>
        {/* Controles: ocupam a largura toda no mobile e encolhem sem estourar */}
        <div className="flex w-full items-center gap-2 sm:w-auto sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-1 rounded-[14px] border border-mist-line bg-ink-bg p-1.5 sm:flex-none sm:gap-2">
            <input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="min-w-0 flex-1 bg-transparent px-1 text-xs text-porcelain-ink outline-none sm:flex-none sm:px-2"
              title="Início"
            />
            <span className="shrink-0 text-xs text-text-subtle">até</span>
            <input
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
              className="min-w-0 flex-1 bg-transparent px-1 text-xs text-porcelain-ink outline-none sm:flex-none sm:px-2"
              title="Fim"
            />
          </div>
          <button
            onClick={() => refetch()}
            aria-label="Atualizar dados"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-mist-line bg-ink-bg text-text-subtle transition-all hover:bg-surface-raised hover:text-porcelain-ink"
          >
            <RefreshCw size={16} className={loadResumo ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Alertas Ativos */}
      {dashboard && dashboard.alertas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {dashboard.alertas.map((alerta, idx) => {
            const Icon = getAlertaIcon(alerta.tipo);
            const classes = getAlertaColor(alerta.tipo);
            const cardContent = (
              <div className={cn(
                "flex items-center justify-between p-3.5 rounded-[16px] border text-xs font-semibold h-full transition-all",
                classes,
                alerta.link && "hover:bg-surface-raised/30 hover:border-current cursor-pointer"
              )}>
                <div className="flex items-center gap-2.5">
                  <Icon size={16} />
                  <span>{alerta.mensagem}</span>
                </div>
                {alerta.link && (
                  <span className="hover:underline flex items-center gap-1 shrink-0 ml-4">
                    Ver <ArrowRight size={12} />
                  </span>
                )}
              </div>
            );

            return alerta.link ? (
              <Link key={idx} href={alerta.link} className="block">
                {cardContent}
              </Link>
            ) : (
              <div key={idx}>{cardContent}</div>
            );
          })}
        </div>
      )}

      {/* Main KPI Stats */}
      <div className={cn("grid gap-4", showFinancials ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" : "grid-cols-1 sm:grid-cols-3")}>
        {showFinancials && (
          <StatCard
            label="Saldo Realizado"
            value={formatCurrency(dashboard?.financeiro.saldo_realizado ?? 0)}
            icon={Wallet}
            color="text-success"
            loading={loadResumo}
            subtitle={`Lucro Estimado: ${formatCurrency(dashboard?.financeiro.lucro_estimado ?? 0)}`}
          />
        )}
        <StatCard
          label="Sessões Hoje"
          value={String(dashboard?.operacional.sessoes_hoje ?? 0)}
          icon={Calendar}
          color="text-info" // Blue color for agenda/schedule status constraint
          loading={loadResumo}
          subtitle={`Próximos 7 dias: ${dashboard?.operacional.sessoes_sete_dias ?? 0}`}
        />
        <StatCard
          label="Conversão Orçamentos"
          value={`${dashboard?.operacional.conversao_orcamento_sessao ?? 0}%`}
          icon={Percent}
          color="text-teal-ink"
          loading={loadResumo}
          subtitle={`Orçamentos Pendentes: ${dashboard?.operacional.orcamentos_pendentes ?? 0}`}
        />
        <StatCard
          label="Clientes Novos"
          value={String(dashboard?.operacional.clientes_novos ?? 0)}
          icon={Users}
          color="text-info"
          loading={loadResumo}
          subtitle={showFinancials ? `Ticket Médio: ${formatCurrency(dashboard?.financeiro.ticket_medio ?? 0)}` : "Total no período"}
        />
      </div>

      {/* Client Portal Link */}
      <div className="bg-ink-bg border border-teal-ink/20 hover:border-teal-ink/40 rounded-[18px] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_0_30px_rgba(47,146,133,0.05)] transition-all">
        <div className="flex min-w-0 items-start gap-4">
          <div className="p-3 bg-teal-ink/10 rounded-[12px] border border-teal-ink/20 shrink-0">
            <ExternalLink size={20} className="text-teal-ink" />
          </div>
          {/* min-w-0 deixa o truncate do link funcionar dentro do flex (sem min-w-0
              o filho assume largura intrínseca e empurra o layout no mobile) */}
          <div className="min-w-0">
            <p className="text-sm font-bold text-porcelain-ink">Portal do cliente</p>
            <p className="text-xs text-text-subtle mt-0.5">Compartilhe este link em redes sociais ou Instagram para receber propostas de orçamentos diretas.</p>
            {portalUrl ? (
              <p className="text-xs font-mono text-teal-ink mt-1 truncate">{portalUrl}</p>
            ) : (
              <div className="h-3 w-40 bg-surface-raised animate-pulse rounded mt-1" />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            onClick={handleCopiarPortal}
            disabled={!portalUrl}
            className="flex items-center gap-2 h-9 px-4 rounded-[12px] bg-teal-ink hover:bg-ink-gold disabled:opacity-40 text-ink-night font-semibold text-xs transition-all"
          >
            <Copy size={13} />
            {copiado ? "Copiado!" : "Copiar link"}
          </button>
          {portalUrl && (
            <a
              href={portalUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 h-9 px-3 rounded-[12px] border border-mist-line bg-ink-bg hover:bg-surface-raised text-text-subtle hover:text-porcelain-ink text-xs transition-all"
            >
              <ExternalLink size={13} />
              Ver portal
            </a>
          )}
        </div>
      </div>

      {/* Analytics Charts & Details - Show only for ADMIN */}
      {showFinancials && dashboard && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cash Flow SVG Chart */}
          <div className="bg-ink-bg border border-mist-line rounded-[18px] p-5 space-y-4 shadow-lg lg:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-porcelain-ink">Fluxo diário no período</h3>
                <p className="text-xs text-text-subtle">Entradas e saídas liquidadas</p>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-success" />
                  <span className="text-text-subtle">Entradas (Pago)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-error-red" />
                  <span className="text-text-subtle">Saídas (Pago)</span>
                </div>
              </div>
              <Link href="/financeiro" className="text-xs text-teal-ink hover:underline">Ir para financeiro</Link>
            </div>
            {dashboard.graficos.fluxo_diario.length === 0 ? (
              <div className="h-48 flex items-center justify-center border border-dashed border-mist-line rounded-[12px] text-xs text-text-subtle">Sem lançamentos no período</div>
            ) : (
              /* Rolagem horizontal DENTRO do card: períodos longos (mês cheio)
                 não estouram mais a viewport. Poucos dias preenchem a largura
                 (flex grow); muitos dias rolam lateralmente sem scroll na página. */
              <div className="overflow-x-auto pt-4 no-scrollbar">
                <div
                  className="flex h-48 min-w-full items-end gap-1"
                  role="img"
                  aria-label={`Gráfico de fluxo diário: ${dashboard.graficos.fluxo_diario.length} dia(s) com entradas e saídas liquidadas no período.`}
                >
                  {dashboard.graficos.fluxo_diario.map((d, idx) => {
                    const maxVal = Math.max(...dashboard.graficos.fluxo_diario.map(fd => Math.max(fd.entradas, fd.saidas)), 1);
                    const entPct = (d.entradas / maxVal) * 100;
                    const saiPct = (d.saidas / maxVal) * 100;
                    const diaLabel = new Date(d.dia + "T00:00:00").toLocaleDateString("pt-BR");
                    return (
                      <div
                        key={idx}
                        className="group relative flex h-full flex-col items-center justify-end"
                        style={{ flex: "1 0 auto", minWidth: 18 }}
                        role="img"
                        aria-label={`${diaLabel}: entradas ${formatCurrency(d.entradas)}, saídas ${formatCurrency(d.saidas)}`}
                      >
                        <div className="flex h-full w-full items-end justify-center gap-0.5" aria-hidden="true">
                          {/* Green color for entradas status constraint */}
                          <div style={{ height: `${entPct}%` }} className="w-2 bg-success rounded-t-[2px] hover:bg-[#68cca0] transition-all" title={`Entrada: ${formatCurrency(d.entradas)}`} />
                          {/* Red color for saídas status constraint */}
                          <div style={{ height: `${saiPct}%` }} className="w-2 bg-error-red rounded-t-[2px] hover:bg-[#c94d4b] transition-all" title={`Saída: ${formatCurrency(d.saidas)}`} />
                        </div>
                        <span className="mt-2 block origin-top-left -rotate-45 text-[10px] text-text-subtle" aria-hidden="true">{d.dia.split("-")[2]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Revenue by Artist List */}
          <div className="bg-ink-bg border border-mist-line rounded-[18px] p-5 space-y-4 shadow-lg flex flex-col">
            <div>
              <h3 className="text-sm font-bold text-porcelain-ink">Faturamento por Artista</h3>
              <p className="text-xs text-text-subtle">Fórmula proporcional no período</p>
            </div>
            <div className="flex-1 flex flex-col justify-center space-y-3">
              {dashboard.graficos.por_artista.length === 0 ? (
                <p className="text-xs text-text-subtle text-center my-10">Nenhuma comissão ou entrada processada</p>
              ) : (
                dashboard.graficos.por_artista.map((art, idx) => {
                  const total = dashboard.financeiro.entradas_pagas || 1;
                  const pct = (art.valor / total) * 100;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-porcelain-ink">
                        <span className="flex items-center gap-1">
                          <Users size={12} className="text-text-subtle" />
                          {art.artista_nome}
                        </span>
                        <span>{formatCurrency(art.valor)}</span>
                      </div>
                      <div className="w-full bg-ink-night h-1.5 rounded-full overflow-hidden border border-mist-line" aria-hidden="true">
                        <div style={{ width: `${pct}%` }} className="bg-teal-ink h-full rounded-full" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
