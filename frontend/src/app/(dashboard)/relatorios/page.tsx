"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, TrendingUp, TrendingDown, DollarSign,
  ClipboardList, CheckCircle, Users, ArrowUp, ArrowDown,
  Minus,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useRole } from "@/lib/auth/useRole";
import { EmptyState } from "@/components/ui/empty-state";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResumoFinanceiro {
  periodo_dias: number;
  receita_total: number;
  receita_periodo: number;
  variacao_percentual: number | null;
  total_atendimentos: number;
  atendimentos_confirmados: number;
  atendimentos_finalizados: number;
  ticket_medio: number | null;
  sinais_recebidos: number;
}

interface StatusCount {
  status: string;
  label: string;
  total: number;
  cor: string;
}

interface RelatorioStatus {
  total_ativos: number;
  por_status: StatusCount[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function VariacaoChip({ v }: { v: number | null }) {
  if (v === null) return <span className="text-xs text-text-subtle">—</span>;
  const positivo = v >= 0;
  return (
    <div className={cn(
      "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-[6px]",
      positivo ? "bg-teal-ink/10 text-teal-ink" : "bg-error-red/10 text-error-red"
    )}>
      {positivo ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
      {Math.abs(v).toFixed(1)}%
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function RelatoriosPage() {
  const [periodo, setPeriodo] = useState(30);
  const { isAdmin, isLoading: loadRole } = useRole();

  const { data: resumo, isLoading: loadResumo } = useQuery({
    queryKey: ["relatorios-resumo", periodo],
    queryFn: () => api.get<ResumoFinanceiro>(`/api/v1/relatorios/resumo?periodo=${periodo}`),
    staleTime: 1000 * 60 * 5,
    enabled: isAdmin,
  });

  const { data: porStatus, isLoading: loadStatus } = useQuery({
    queryKey: ["relatorios-status"],
    queryFn: () => api.get<RelatorioStatus>("/api/v1/relatorios/por-status"),
    staleTime: 1000 * 60 * 5,
    enabled: isAdmin,
  });

  const PERIODOS = [
    { label: "7 dias", value: 7 },
    { label: "30 dias", value: 30 },
    { label: "90 dias", value: 90 },
    { label: "1 ano", value: 365 },
  ];

  const maxTotal = Math.max(...(porStatus?.por_status.map(s => s.total) ?? [1]));

  // Guard de papel — espelha o backend (Relatórios = ADMIN). Enquanto o papel
  // carrega, mostra skeleton; não-admins veem empty-state em vez de tomar 403.
  if (loadRole) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-surface-raised rounded mb-2" />
        <div className="h-4 w-72 bg-surface-raised rounded mb-6" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-ink-bg border border-mist-line rounded-[18px]" />
          ))}
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <EmptyState
          title="Apenas administradores"
          description="Os relatórios do estúdio estão disponíveis somente para administradores. Fale com o responsável pela conta se precisar de acesso."
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-porcelain-ink">Relatórios</h1>
          <p className="text-sm text-text-subtle mt-1">Métricas financeiras e operacionais</p>
        </div>
        {/* Selector de período */}
        <div className="flex items-center gap-1 bg-ink-bg border border-mist-line rounded-[12px] p-1">
          {PERIODOS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriodo(p.value)}
              className={cn(
                "px-3 py-1.5 rounded-[8px] text-xs font-medium transition-all",
                periodo === p.value
                  ? "bg-teal-ink text-ink-night"
                  : "text-text-subtle hover:text-porcelain-ink"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards de métricas principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Receita no período */}
        <div className="bg-ink-bg border border-mist-line rounded-[18px] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-teal-ink/10 rounded-[10px]">
              <DollarSign size={16} className="text-teal-ink" />
            </div>
            {!loadResumo && <VariacaoChip v={resumo?.variacao_percentual ?? null} />}
          </div>
          <p className="text-2xl font-bold text-porcelain-ink">
            {loadResumo ? "—" : formatBRL(resumo?.receita_periodo ?? 0)}
          </p>
          <p className="text-xs text-text-subtle mt-1">Receita nos últimos {periodo} dias</p>
        </div>

        {/* Receita total */}
        <div className="bg-ink-bg border border-mist-line rounded-[18px] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-copper-needle/10 rounded-[10px]">
              <TrendingUp size={16} className="text-copper-needle" />
            </div>
          </div>
          <p className="text-2xl font-bold text-porcelain-ink">
            {loadResumo ? "—" : formatBRL(resumo?.receita_total ?? 0)}
          </p>
          <p className="text-xs text-text-subtle mt-1">Receita total histórica</p>
        </div>

        {/* Ticket médio */}
        <div className="bg-ink-bg border border-mist-line rounded-[18px] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-text-subtle/10 rounded-[10px]">
              <BarChart size={16} className="text-text-subtle" />
            </div>
          </div>
          <p className="text-2xl font-bold text-porcelain-ink">
            {loadResumo ? "—" : resumo?.ticket_medio ? formatBRL(resumo.ticket_medio) : "—"}
          </p>
          <p className="text-xs text-text-subtle mt-1">Ticket médio (finalizados)</p>
        </div>

        {/* Total de atendimentos */}
        <div className="bg-ink-bg border border-mist-line rounded-[18px] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-teal-ink/10 rounded-[10px]">
              <ClipboardList size={16} className="text-teal-ink" />
            </div>
          </div>
          <p className="text-2xl font-bold text-porcelain-ink">
            {loadResumo ? "—" : resumo?.total_atendimentos ?? 0}
          </p>
          <p className="text-xs text-text-subtle mt-1">Atendimentos totais</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Status dos atendimentos (gráfico de barras CSS) */}
        <div className="bg-ink-bg border border-mist-line rounded-[18px] p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-porcelain-ink">Atendimentos por Status</h2>
            {porStatus && (
              <span className="text-xs text-text-subtle bg-ink-night border border-mist-line px-2 py-0.5 rounded-[6px]">
                {porStatus.total_ativos} ativos
              </span>
            )}
          </div>

          {loadStatus ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 bg-surface-raised rounded-[8px] animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {(porStatus?.por_status ?? []).map(s => {
                const pct = maxTotal > 0 ? (s.total / maxTotal) * 100 : 0;
                return (
                  <div key={s.status}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-text-subtle">{s.label}</span>
                      <span className="text-xs font-medium text-porcelain-ink">{s.total}</span>
                    </div>
                    <div className="h-2 bg-ink-night rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: s.cor }}
                      />
                    </div>
                  </div>
                );
              })}
              {!porStatus?.por_status.length && (
                <p className="text-xs text-text-subtle text-center py-4">Nenhum atendimento encontrado</p>
              )}
            </div>
          )}
        </div>

        {/* Resumo operacional */}
        <div className="bg-ink-bg border border-mist-line rounded-[18px] p-5">
          <h2 className="text-sm font-semibold text-porcelain-ink mb-5">Resumo Operacional</h2>

          {loadResumo ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-surface-raised rounded-[8px] animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {[
                {
                  label: "Confirmados",
                  valor: resumo?.atendimentos_confirmados ?? 0,
                  icon: CheckCircle,
                  cor: "text-teal-ink",
                  bg: "bg-teal-ink/10",
                },
                {
                  label: "Finalizados",
                  valor: resumo?.atendimentos_finalizados ?? 0,
                  icon: CheckCircle,
                  cor: "text-[#4CAF82]",
                  bg: "bg-[#4CAF82]/10",
                },
                {
                  label: "Sinais recebidos",
                  valor: formatBRL(resumo?.sinais_recebidos ?? 0),
                  icon: DollarSign,
                  cor: "text-copper-needle",
                  bg: "bg-copper-needle/10",
                },
                {
                  label: "Total de atendimentos",
                  valor: resumo?.total_atendimentos ?? 0,
                  icon: ClipboardList,
                  cor: "text-text-subtle",
                  bg: "bg-text-subtle/10",
                },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center gap-3 p-3 bg-ink-night border border-mist-line rounded-[10px]">
                    <div className={cn("p-2 rounded-[8px] shrink-0", item.bg)}>
                      <Icon size={14} className={item.cor} />
                    </div>
                    <span className="text-sm text-text-subtle flex-1">{item.label}</span>
                    <span className="text-sm font-semibold text-porcelain-ink">{item.valor}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Nota de comparação */}
      {resumo?.variacao_percentual !== null && resumo?.variacao_percentual !== undefined && (
        <div className={cn(
          "mt-5 flex items-center gap-3 p-4 rounded-[14px] border text-sm",
          resumo.variacao_percentual >= 0
            ? "bg-teal-ink/5 border-teal-ink/20 text-teal-ink"
            : "bg-error-red/5 border-error-red/20 text-error-red"
        )}>
          {resumo.variacao_percentual >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          <span className="text-porcelain-ink">
            Receita {resumo.variacao_percentual >= 0 ? "aumentou" : "caiu"}{" "}
            <strong>{Math.abs(resumo.variacao_percentual).toFixed(1)}%</strong>{" "}
            em relação ao período anterior de {periodo} dias.
          </span>
        </div>
      )}
    </div>
  );
}
