"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, ChevronLeft, ChevronRight, Clock, Plus, X, Loader2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Sessao {
  id: string;
  data_sessao: string;
  duracao_minutos: number | null;
  tipo: string;
  status_operacional: string;
  descricao: string | null;
  estilo: string | null;
  parte_corpo: string | null;
  valor_total: number | null;
  cliente_id: string | null;
}

interface AgendaMes {
  ano: number;
  mes: number;
  total_sessoes: number;
  sessoes: Sessao[];
  dias_com_sessao: number[];
}

interface ProximaSessao {
  id: string;
  data_sessao: string;
  tipo: string;
  status_operacional: string;
  descricao: string | null;
  duracao_minutos: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DAYS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDayOfMonth(y: number, m: number) { return new Date(y, m, 1).getDay(); }

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });
}

const STATUS_COR: Record<string, string> = {
  CONFIRMADO: "text-teal-ink bg-teal-ink/10",
  EM_ATENDIMENTO: "text-teal-ink bg-teal-ink/10",
  SOLICITADO: "text-copper-needle bg-copper-needle/10",
  AGUARDANDO_SINAL: "text-copper-needle bg-copper-needle/10",
  FINALIZADO: "text-text-subtle bg-text-subtle/10",
};

// ---------------------------------------------------------------------------
// Modal: Agendar Sessão
// ---------------------------------------------------------------------------

function AgendarSessaoModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [atendimentoId, setAtendimentoId] = useState("");
  const [dataHora, setDataHora] = useState("");
  const [duracao, setDuracao] = useState("120");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const { data: atendimentos = [], isLoading } = useQuery<any[]>({
    queryKey: ["atendimentos"],
    queryFn: () => api.get("/api/v1/atendimentos/"),
    select: (data) =>
      data.filter((a: any) =>
        !["FINALIZADO", "CANCELADO_CLIENTE", "CANCELADO_ESTUDIO", "NAO_COMPARECEU"].includes(
          a.status_operacional
        )
      ),
  });

  const mutation = useMutation({
    mutationFn: (payload: { atendimento_id: string; data_sessao: string; duracao_minutos: number }) =>
      api.post("/api/v1/agenda/agendar", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
      queryClient.invalidateQueries({ queryKey: ["agenda-proximas"] });
      setSucesso(true);
      setTimeout(onClose, 1200);
    },
    onError: (err: Error) => setErro(err.message || "Erro ao agendar sessão."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!atendimentoId) { setErro("Selecione um atendimento."); return; }
    if (!dataHora) { setErro("Informe a data e hora."); return; }
    mutation.mutate({
      atendimento_id: atendimentoId,
      data_sessao: new Date(dataHora).toISOString(),
      duracao_minutos: parseInt(duracao) || 120,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-ink-bg border border-mist-line rounded-[18px] shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-mist-line">
          <h2 className="text-base font-bold text-porcelain-ink">Agendar Sessão</h2>
          <button onClick={onClose} className="p-2 rounded-[10px] text-text-subtle hover:text-porcelain-ink hover:bg-surface-raised transition-all">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-subtle mb-1.5">Atendimento</label>
            {isLoading ? (
              <div className="h-10 bg-surface-raised animate-pulse rounded-[12px]" />
            ) : atendimentos.length === 0 ? (
              <p className="text-sm text-text-subtle p-3 bg-ink-night border border-mist-line rounded-[12px]">
                Nenhum atendimento sem sessão.{" "}
                <a href="/atendimentos" className="text-teal-ink hover:underline">Criar novo</a>
              </p>
            ) : (
              <select
                value={atendimentoId}
                onChange={(e) => setAtendimentoId(e.target.value)}
                className="w-full h-10 px-3 rounded-[12px] bg-ink-night border border-mist-line text-porcelain-ink text-sm focus:border-teal-ink/60 outline-none cursor-pointer"
              >
                <option value="">Selecione um atendimento...</option>
                {atendimentos.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.tipo}{a.estilo ? ` — ${a.estilo}` : ""}
                    {a.cliente ? ` · ${a.cliente.nome}` : ""}
                    {a.data_sessao ? ` (reagendar)` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-text-subtle mb-1.5">Data e Hora</label>
            <input
              type="datetime-local"
              value={dataHora}
              onChange={(e) => setDataHora(e.target.value)}
              className="w-full h-10 px-3 rounded-[12px] bg-ink-night border border-mist-line text-porcelain-ink text-sm focus:border-teal-ink/60 outline-none [color-scheme:dark]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-subtle mb-1.5">Duração (minutos)</label>
            <input
              type="number"
              min={15}
              step={15}
              value={duracao}
              onChange={(e) => setDuracao(e.target.value)}
              className="w-full h-10 px-3 rounded-[12px] bg-ink-night border border-mist-line text-porcelain-ink text-sm focus:border-teal-ink/60 outline-none"
            />
          </div>

          {erro && (
            <p className="text-sm text-error-red p-3 bg-error-red/10 border border-error-red/30 rounded-[10px]">{erro}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 h-10 rounded-[12px] border border-mist-line text-sm text-text-subtle hover:text-porcelain-ink hover:bg-surface-raised transition-all">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || sucesso}
              className="flex-1 h-10 rounded-[12px] bg-teal-ink hover:bg-ink-gold disabled:opacity-50 text-ink-night font-semibold text-sm transition-all flex items-center justify-center gap-2"
            >
              {mutation.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Agendando...</>
              ) : sucesso ? "Agendado!" : "Agendar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function AgendaPage() {
  const now = new Date();
  const [current, setCurrent] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [diaSelecionado, setDiaSelecionado] = useState<number | null>(now.getDate());
  const [modalAgendar, setModalAgendar] = useState(false);

  const isCurrentMonth = current.year === now.getFullYear() && current.month === now.getMonth();
  const today = now.getDate();

  const prev = () => {
    setCurrent(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 });
    setDiaSelecionado(null);
  };
  const next = () => {
    setCurrent(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 });
    setDiaSelecionado(null);
  };

  // Query: sessões do mês atual
  const { data: agenda, isLoading } = useQuery({
    queryKey: ["agenda", current.year, current.month + 1],
    queryFn: () =>
      api.get<AgendaMes>(`/api/v1/agenda/?ano=${current.year}&mes=${current.month + 1}`),
    staleTime: 1000 * 60 * 2,
  });

  // Query: próximas sessões (7 dias)
  const { data: proximas } = useQuery({
    queryKey: ["agenda-proximas"],
    queryFn: () => api.get<ProximaSessao[]>("/api/v1/agenda/proximas?dias=7"),
    staleTime: 1000 * 60 * 2,
  });

  const diasComSessao = new Set(agenda?.dias_com_sessao ?? []);

  // Sessões do dia selecionado
  const sessoesDia = diaSelecionado
    ? (agenda?.sessoes ?? []).filter(s => new Date(s.data_sessao).getDate() === diaSelecionado)
    : [];

  const daysInMonth = getDaysInMonth(current.year, current.month);
  const firstDay = getFirstDayOfMonth(current.year, current.month);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-porcelain-ink">Agenda</h1>
          <p className="text-sm text-text-subtle mt-1">
            {isLoading ? "Carregando…" : `${agenda?.total_sessoes ?? 0} sessão${agenda?.total_sessoes !== 1 ? "ões" : ""} em ${MONTHS[current.month]}`}
          </p>
        </div>
        <button
          onClick={() => setModalAgendar(true)}
          className="flex items-center gap-2 h-10 px-4 rounded-[14px] bg-teal-ink hover:bg-ink-gold text-ink-night font-semibold text-sm transition-all"
        >
          <Plus size={16} />
          Agendar Sessão
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Calendário */}
        <div className="lg:col-span-2 bg-ink-bg border border-mist-line rounded-[18px] p-5">
          {/* Nav */}
          <div className="flex items-center justify-between mb-5">
            <button onClick={prev} className="w-9 h-9 flex items-center justify-center rounded-[10px] border border-mist-line text-text-subtle hover:text-porcelain-ink hover:bg-surface-raised transition-all">
              <ChevronLeft size={16} />
            </button>
            <h2 className="font-semibold text-porcelain-ink">
              {MONTHS[current.month]} {current.year}
            </h2>
            <button onClick={next} className="w-9 h-9 flex items-center justify-center rounded-[10px] border border-mist-line text-text-subtle hover:text-porcelain-ink hover:bg-surface-raised transition-all">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Cabeçalho dos dias */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[11px] font-medium text-text-subtle pb-2">{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isToday = isCurrentMonth && day === today;
              const temSessao = diasComSessao.has(day);
              const selecionado = diaSelecionado === day;

              return (
                <button
                  key={day}
                  onClick={() => setDiaSelecionado(selecionado ? null : day)}
                  className={cn(
                    "relative aspect-square flex flex-col items-center justify-center text-sm rounded-[10px] transition-all",
                    selecionado
                      ? "bg-teal-ink text-ink-night font-bold"
                      : isToday
                      ? "bg-teal-ink/20 text-teal-ink font-bold ring-1 ring-teal-ink/40"
                      : "text-text-subtle hover:bg-surface-raised hover:text-porcelain-ink"
                  )}
                >
                  <span>{day}</span>
                  {temSessao && (
                    <span className={cn(
                      "absolute bottom-1 w-1 h-1 rounded-full",
                      selecionado ? "bg-ink-night" : "bg-teal-ink"
                    )} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legenda */}
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-mist-line">
            <div className="flex items-center gap-1.5 text-xs text-text-subtle">
              <span className="w-2 h-2 rounded-full bg-teal-ink" />
              Com sessão
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-subtle">
              <span className="w-2 h-2 rounded-full bg-teal-ink/20 ring-1 ring-teal-ink/40" />
              Hoje
            </div>
          </div>
        </div>

        {/* Painel lateral: Sessões do dia + Próximas */}
        <div className="space-y-4">
          {/* Sessões do dia selecionado */}
          <div className="bg-ink-bg border border-mist-line rounded-[18px] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-porcelain-ink">
                {diaSelecionado
                  ? `${diaSelecionado} de ${MONTHS[current.month]}`
                  : "Selecione um dia"}
              </h3>
              {diaSelecionado && (
                <button onClick={() => setDiaSelecionado(null)} className="text-text-subtle hover:text-porcelain-ink">
                  <X size={14} />
                </button>
              )}
            </div>

            {!diaSelecionado && (
              <div className="flex flex-col items-center py-6 text-center">
                <Calendar size={28} className="text-mist-line mb-2" />
                <p className="text-xs text-text-subtle">Clique em um dia para ver as sessões</p>
              </div>
            )}

            {diaSelecionado && sessoesDia.length === 0 && (
              <div className="flex flex-col items-center py-6 text-center">
                <Calendar size={28} className="text-mist-line mb-2" />
                <p className="text-xs text-text-subtle">Nenhuma sessão neste dia</p>
              </div>
            )}

            <div className="space-y-2">
              {sessoesDia.map(s => (
                <div key={s.id} className="p-3 bg-ink-night border border-mist-line rounded-[10px]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-porcelain-ink">{formatHora(s.data_sessao)}</span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-[4px]", STATUS_COR[s.status_operacional] ?? "text-text-subtle bg-text-subtle/10")}>
                      {s.status_operacional.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs text-text-subtle truncate">{s.descricao ?? s.tipo}</p>
                  {s.duracao_minutos && (
                    <div className="flex items-center gap-1 mt-1">
                      <Clock size={10} className="text-text-subtle" />
                      <span className="text-[10px] text-text-subtle">{s.duracao_minutos} min</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Próximas 7 dias */}
          <div className="bg-ink-bg border border-mist-line rounded-[18px] p-5">
            <h3 className="text-sm font-semibold text-porcelain-ink mb-4">Próximos 7 dias</h3>
            {!proximas || proximas.length === 0 ? (
              <div className="flex flex-col items-center py-4 text-center">
                <p className="text-xs text-text-subtle">Nenhuma sessão agendada</p>
              </div>
            ) : (
              <div className="space-y-2">
                {proximas.map(s => (
                  <div key={s.id} className="flex items-start gap-2 p-2 rounded-[8px] hover:bg-ink-night transition-colors">
                    <div className="w-8 h-8 rounded-[8px] bg-teal-ink/10 flex items-center justify-center shrink-0">
                      <Calendar size={13} className="text-teal-ink" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-porcelain-ink truncate">{s.descricao ?? s.tipo}</p>
                      <p className="text-[10px] text-text-subtle">{formatData(s.data_sessao)} · {formatHora(s.data_sessao)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {modalAgendar && <AgendarSessaoModal onClose={() => setModalAgendar(false)} />}
    </div>
  );
}
