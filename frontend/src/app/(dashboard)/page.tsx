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
    <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-5 flex items-center justify-between shadow-[0_18px_50px_rgba(0,0,0,0.35)] hover:border-[#2F9285]/20 transition-all">
      <div>
        <p className="text-[11px] text-[#87938F] font-bold uppercase tracking-wider mb-1">{label}</p>
        {loading ? (
          <div className="h-8 w-24 bg-[#102128] animate-pulse rounded" />
        ) : (
          <p className="text-2xl font-extrabold text-[#F0EADD]">{value}</p>
        )}
        {subtitle && <p className="text-[10px] text-[#87938F] mt-1">{subtitle}</p>}
      </div>
      <div className="p-3 bg-[#102128] rounded-[12px] border border-[#243337]">
        <Icon size={20} className={color} />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-[#102128] rounded" />
          <div className="h-4 w-72 bg-[#102128] rounded" />
        </div>
        <div className="h-10 w-44 bg-[#102128] rounded" />
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-5 flex items-center justify-between h-28">
            <div className="space-y-2 flex-1">
              <div className="h-3 w-20 bg-[#102128] rounded" />
              <div className="h-8 w-24 bg-[#102128] rounded" />
              <div className="h-3 w-32 bg-[#102128] rounded" />
            </div>
            <div className="w-10 h-10 bg-[#102128] rounded-[12px] border border-[#243337]" />
          </div>
        ))}
      </div>

      {/* Client Portal Link Skeleton */}
      <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 h-24">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#102128] rounded-[12px]" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-[#102128] rounded" />
            <div className="h-3 w-64 bg-[#102128] rounded" />
          </div>
        </div>
        <div className="h-9 w-24 bg-[#102128] rounded-[12px]" />
      </div>

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-5 h-64 lg:col-span-2 space-y-4">
          <div className="h-4 w-32 bg-[#102128] rounded" />
          <div className="h-36 bg-[#102128]/40 rounded-[12px]" />
        </div>
        <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-5 h-64 space-y-4">
          <div className="h-4 w-32 bg-[#102128] rounded" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-[#102128] rounded" />
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
        return "text-[#E35D5B] bg-[#E35D5B]/10 border-[#E35D5B]/20"; // Red
      case "SEM_PAGAMENTO":
        return "text-[#D99A3D] bg-[#D99A3D]/10 border-[#D99A3D]/20"; // Yellow
      case "COMISSAO_PENDENTE":
        return "text-[#A78BFA] bg-[#A78BFA]/10 border-[#A78BFA]/20"; // Purple
      case "SINAL_PENDENTE":
      case "ORCAMENTO_PARADO":
        return "text-[#5E9ED6] bg-[#5E9ED6]/10 border-[#5E9ED6]/20"; // Blue
      default:
        return "text-[#D99A3D] bg-[#D99A3D]/10 border-[#D99A3D]/20"; // Yellow
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#F0EADD] tracking-tight">Painel Inicial</h1>
          <p className="text-sm text-[#87938F]">Desempenho operacional, faturamento e alertas do estúdio</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 p-1.5 bg-[#0B171C] border border-[#243337] rounded-[14px]">
            <input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="bg-transparent text-xs text-[#F0EADD] outline-none px-2"
              title="Início"
            />
            <span className="text-xs text-[#87938F]">até</span>
            <input
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
              className="bg-transparent text-xs text-[#F0EADD] outline-none px-2"
              title="Fim"
            />
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center justify-center w-10 h-10 rounded-[14px] border border-[#243337] bg-[#0B171C] hover:bg-[#102128] text-[#87938F] hover:text-[#F0EADD] transition-all"
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
                alerta.link && "hover:bg-[#102128]/30 hover:border-current cursor-pointer"
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
            color="text-[#54B88D]"
            loading={loadResumo}
            subtitle={`Lucro Estimado: ${formatCurrency(dashboard?.financeiro.lucro_estimado ?? 0)}`}
          />
        )}
        <StatCard
          label="Sessões Hoje"
          value={String(dashboard?.operacional.sessoes_hoje ?? 0)}
          icon={Calendar}
          color="text-[#5E9ED6]" // Blue color for agenda/schedule status constraint
          loading={loadResumo}
          subtitle={`Próximos 7 dias: ${dashboard?.operacional.sessoes_sete_dias ?? 0}`}
        />
        <StatCard
          label="Conversão Orçamentos"
          value={`${dashboard?.operacional.conversao_orcamento_sessao ?? 0}%`}
          icon={Percent}
          color="text-[#2F9285]"
          loading={loadResumo}
          subtitle={`Orçamentos Pendentes: ${dashboard?.operacional.orcamentos_pendentes ?? 0}`}
        />
        <StatCard
          label="Clientes Novos"
          value={String(dashboard?.operacional.clientes_novos ?? 0)}
          icon={Users}
          color="text-[#5E9ED6]"
          loading={loadResumo}
          subtitle={showFinancials ? `Ticket Médio: ${formatCurrency(dashboard?.financeiro.ticket_medio ?? 0)}` : "Total no período"}
        />
      </div>

      {/* Client Portal Link */}
      <div className="bg-[#0B171C] border border-[#2F9285]/20 hover:border-[#2F9285]/40 rounded-[18px] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_0_30px_rgba(47,146,133,0.05)] transition-all">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-[#2F9285]/10 rounded-[12px] border border-[#2F9285]/20 shrink-0">
            <ExternalLink size={20} className="text-[#2F9285]" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#F0EADD]">Portal do cliente</p>
            <p className="text-xs text-[#87938F] mt-0.5">Compartilhe este link em redes sociais ou Instagram para receber propostas de orçamentos diretas.</p>
            {portalUrl ? (
              <p className="text-xs font-mono text-[#2F9285] mt-1 truncate max-w-md">{portalUrl}</p>
            ) : (
              <div className="h-3 w-40 bg-[#102128] animate-pulse rounded mt-1" />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            onClick={handleCopiarPortal}
            disabled={!portalUrl}
            className="flex items-center gap-2 h-9 px-4 rounded-[12px] bg-[#2F9285] hover:bg-[#3AA99A] disabled:opacity-40 text-[#050B12] font-semibold text-xs transition-all"
          >
            <Copy size={13} />
            {copiado ? "Copiado!" : "Copiar link"}
          </button>
          {portalUrl && (
            <a
              href={portalUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 h-9 px-3 rounded-[12px] border border-[#243337] bg-[#0B171C] hover:bg-[#102128] text-[#87938F] hover:text-[#F0EADD] text-xs transition-all"
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
          <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-5 space-y-4 shadow-lg lg:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#F0EADD]">Fluxo diário no período</h3>
                <p className="text-xs text-[#87938F]">Entradas e saídas liquidadas</p>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-[#54B88D]" />
                  <span className="text-[#87938F]">Entradas (Pago)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-[#E35D5B]" />
                  <span className="text-[#87938F]">Saídas (Pago)</span>
                </div>
              </div>
              <Link href="/financeiro" className="text-xs text-[#2F9285] hover:underline">Ir para financeiro</Link>
            </div>
            {dashboard.graficos.fluxo_diario.length === 0 ? (
              <div className="h-48 flex items-center justify-center border border-dashed border-[#243337] rounded-[12px] text-xs text-[#87938F]">Sem lançamentos no período</div>
            ) : (
              <div className="pt-4 h-48 flex items-end gap-1">
                {dashboard.graficos.fluxo_diario.map((d, idx) => {
                  const maxVal = Math.max(...dashboard.graficos.fluxo_diario.map(fd => Math.max(fd.entradas, fd.saidas)), 1);
                  const entPct = (d.entradas / maxVal) * 100;
                  const saiPct = (d.saidas / maxVal) * 100;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                      <div className="w-full flex gap-0.5 justify-center items-end h-full">
                        {/* Green color for entradas status constraint */}
                        <div style={{ height: `${entPct}%` }} className="w-2 bg-[#54B88D] rounded-t-[2px] hover:bg-[#68cca0] transition-all" title={`Entrada: ${formatCurrency(d.entradas)}`} />
                        {/* Red color for saídas status constraint */}
                        <div style={{ height: `${saiPct}%` }} className="w-2 bg-[#E35D5B] rounded-t-[2px] hover:bg-[#c94d4b] transition-all" title={`Saída: ${formatCurrency(d.saidas)}`} />
                      </div>
                      <span className="text-[8px] text-[#87938F] mt-2 block transform -rotate-45 origin-top-left translate-y-1">{d.dia.split("-")[2]}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Revenue by Artist List */}
          <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-5 space-y-4 shadow-lg flex flex-col">
            <div>
              <h3 className="text-sm font-bold text-[#F0EADD]">Faturamento por Artista</h3>
              <p className="text-xs text-[#87938F]">Fórmula proporcional no período</p>
            </div>
            <div className="flex-1 flex flex-col justify-center space-y-3">
              {dashboard.graficos.por_artista.length === 0 ? (
                <p className="text-xs text-[#87938F] text-center my-10">Nenhuma comissão ou entrada processada</p>
              ) : (
                dashboard.graficos.por_artista.map((art, idx) => {
                  const total = dashboard.financeiro.entradas_pagas || 1;
                  const pct = (art.valor / total) * 100;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-[#F0EADD]">
                        <span className="flex items-center gap-1">
                          <Users size={12} className="text-[#87938F]" />
                          {art.artista_nome}
                        </span>
                        <span>{formatCurrency(art.valor)}</span>
                      </div>
                      <div className="w-full bg-[#050B12] h-1.5 rounded-full overflow-hidden border border-[#243337]">
                        <div style={{ width: `${pct}%` }} className="bg-[#2F9285] h-full rounded-full" />
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
