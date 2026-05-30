"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, ChevronLeft, ChevronRight, Clock, Plus, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClienteAtendimento {
  id: string;
  nome: string;
  telefone: string | null;
  instagram: string | null;
  email: string | null;
}

interface Atendimento {
  id: string;
  tipo: string;
  estilo: string | null;
  parte_corpo: string | null;
  descricao: string | null;
  status_operacional: string;
  status_financeiro: string;
  valor_total: number | null;
  valor_sinal: number | null;
  tamanho_cm: string | null;
  notas_privadas: string | null;
  data_sessao: string | null;
  cliente: ClienteAtendimento | null;
}

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
  CONFIRMADO: "text-[#2F9285] bg-[#2F9285]/10",
  EM_ATENDIMENTO: "text-[#2F9285] bg-[#2F9285]/10",
  SOLICITADO: "text-[#C36B3F] bg-[#C36B3F]/10",
  AGUARDANDO_SINAL: "text-[#C36B3F] bg-[#C36B3F]/10",
  FINALIZADO: "text-[#87938F] bg-[#87938F]/10",
};

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function AgendaPage() {
  const now = new Date();
  const [current, setCurrent] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [diaSelecionado, setDiaSelecionado] = useState<number | null>(now.getDate());
  const [modalAberto, setModalAberto] = useState(false);

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
          <h1 className="text-2xl font-bold text-[#F0EADD]">Agenda</h1>
          <p className="text-sm text-[#87938F] mt-1">
            {isLoading ? "Carregando…" : `${agenda?.total_sessoes ?? 0} sessão${agenda?.total_sessoes !== 1 ? "ões" : ""} em ${MONTHS[current.month]}`}
          </p>
        </div>
        <button
          onClick={() => setModalAberto(true)}
          className="flex items-center gap-2 h-10 px-4 rounded-[14px] bg-[#2F9285] hover:bg-[#3AA99A] text-[#050B12] font-semibold text-sm transition-all"
        >
          <Plus size={16} />
          Agendar Sessão
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Calendário */}
        <div className="lg:col-span-2 bg-[#0B171C] border border-[#243337] rounded-[18px] p-5">
          {/* Nav */}
          <div className="flex items-center justify-between mb-5">
            <button onClick={prev} className="w-9 h-9 flex items-center justify-center rounded-[10px] border border-[#243337] text-[#87938F] hover:text-[#F0EADD] hover:bg-[#102128] transition-all">
              <ChevronLeft size={16} />
            </button>
            <h2 className="font-semibold text-[#F0EADD]">
              {MONTHS[current.month]} {current.year}
            </h2>
            <button onClick={next} className="w-9 h-9 flex items-center justify-center rounded-[10px] border border-[#243337] text-[#87938F] hover:text-[#F0EADD] hover:bg-[#102128] transition-all">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Cabeçalho dos dias */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[11px] font-medium text-[#87938F] pb-2">{d}</div>
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
                      ? "bg-[#2F9285] text-[#050B12] font-bold"
                      : isToday
                      ? "bg-[#2F9285]/20 text-[#2F9285] font-bold ring-1 ring-[#2F9285]/40"
                      : "text-[#87938F] hover:bg-[#102128] hover:text-[#F0EADD]"
                  )}
                >
                  <span>{day}</span>
                  {temSessao && (
                    <span className={cn(
                      "absolute bottom-1 w-1 h-1 rounded-full",
                      selecionado ? "bg-[#050B12]" : "bg-[#2F9285]"
                    )} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legenda */}
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[#243337]">
            <div className="flex items-center gap-1.5 text-xs text-[#87938F]">
              <span className="w-2 h-2 rounded-full bg-[#2F9285]" />
              Com sessão
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#87938F]">
              <span className="w-2 h-2 rounded-full bg-[#2F9285]/20 ring-1 ring-[#2F9285]/40" />
              Hoje
            </div>
          </div>
        </div>

        {/* Painel lateral: Sessões do dia + Próximas */}
        <div className="space-y-4">
          {/* Sessões do dia selecionado */}
          <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#F0EADD]">
                {diaSelecionado
                  ? `${diaSelecionado} de ${MONTHS[current.month]}`
                  : "Selecione um dia"}
              </h3>
              {diaSelecionado && (
                <button onClick={() => setDiaSelecionado(null)} className="text-[#87938F] hover:text-[#F0EADD]">
                  <X size={14} />
                </button>
              )}
            </div>

            {!diaSelecionado && (
              <div className="flex flex-col items-center py-6 text-center">
                <Calendar size={28} className="text-[#243337] mb-2" />
                <p className="text-xs text-[#87938F]">Clique em um dia para ver as sessões</p>
              </div>
            )}

            {diaSelecionado && sessoesDia.length === 0 && (
              <div className="flex flex-col items-center py-6 text-center">
                <Calendar size={28} className="text-[#243337] mb-2" />
                <p className="text-xs text-[#87938F]">Nenhuma sessão neste dia</p>
              </div>
            )}

            <div className="space-y-2">
              {sessoesDia.map(s => (
                <div key={s.id} className="p-3 bg-[#050B12] border border-[#243337] rounded-[10px]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-[#F0EADD]">{formatHora(s.data_sessao)}</span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-[4px]", STATUS_COR[s.status_operacional] ?? "text-[#87938F] bg-[#87938F]/10")}>
                      {s.status_operacional.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs text-[#87938F] truncate">{s.descricao ?? s.tipo}</p>
                  {s.duracao_minutos && (
                    <div className="flex items-center gap-1 mt-1">
                      <Clock size={10} className="text-[#87938F]" />
                      <span className="text-[10px] text-[#87938F]">{s.duracao_minutos} min</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Próximas 7 dias */}
          <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-5">
            <h3 className="text-sm font-semibold text-[#F0EADD] mb-4">Próximos 7 dias</h3>
            {!proximas || proximas.length === 0 ? (
              <div className="flex flex-col items-center py-4 text-center">
                <p className="text-xs text-[#87938F]">Nenhuma sessão agendada</p>
              </div>
            ) : (
              <div className="space-y-2">
                {proximas.map(s => (
                  <div key={s.id} className="flex items-start gap-2 p-2 rounded-[8px] hover:bg-[#050B12] transition-colors">
                    <div className="w-8 h-8 rounded-[8px] bg-[#2F9285]/10 flex items-center justify-center shrink-0">
                      <Calendar size={13} className="text-[#2F9285]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-[#F0EADD] truncate">{s.descricao ?? s.tipo}</p>
                      <p className="text-[10px] text-[#87938F]">{formatData(s.data_sessao)} · {formatHora(s.data_sessao)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <AgendarSessaoModal isOpen={modalAberto} onClose={() => setModalAberto(false)} />
    </div>
  );
}

function AgendarSessaoModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [atendimentoId, setAtendimentoId] = useState("");
  const [dataSessao, setDataSessao] = useState("");
  const [duracaoMinutos, setDuracaoMinutos] = useState("120");
  const [erro, setErro] = useState<string | null>(null);

  const { data: atendimentos, isLoading } = useQuery<Atendimento[]>({
    queryKey: ["atendimentos"],
    queryFn: () => api.get<Atendimento[]>("/api/v1/atendimentos/"),
    enabled: isOpen,
  });

  const mutation = useMutation({
    mutationFn: (payload: { atendimento_id: string; data_sessao: string; duracao_minutos: number }) =>
      api.post("/api/v1/agenda/agendar", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
      queryClient.invalidateQueries({ queryKey: ["agenda-proximas"] });
      queryClient.invalidateQueries({ queryKey: ["atendimentos"] });
      onClose();
    },
    onError: (err: Error) => {
      setErro(err.message || "Erro ao agendar sessão.");
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!atendimentoId) {
      setErro("Selecione um atendimento.");
      return;
    }
    if (!dataSessao) {
      setErro("Selecione a data e hora da sessão.");
      return;
    }

    const dateObj = new Date(dataSessao);
    if (isNaN(dateObj.getTime())) {
      setErro("Data/Hora inválida.");
      return;
    }

    mutation.mutate({
      atendimento_id: atendimentoId,
      data_sessao: dateObj.toISOString(),
      duracao_minutos: parseInt(duracaoMinutos, 10),
    });
  };

  const inputCls =
    "w-full h-10 px-3 rounded-[12px] bg-[#050B12] border border-[#243337] text-[#F0EADD] text-sm placeholder-[#87938F] focus:border-[#2F9285]/60 outline-none transition-colors";
  const labelCls = "block text-xs font-medium text-[#87938F] mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-[#0B171C] border border-[#243337] rounded-[18px] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#243337]">
          <div>
            <h2 className="text-base font-bold text-[#F0EADD]">Agendar Sessão</h2>
            <p className="text-xs text-[#87938F] mt-0.5">Vincule uma data a um atendimento</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-[10px] text-[#87938F] hover:text-[#F0EADD] hover:bg-[#102128] transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">
            {erro && (
              <div className="p-3 rounded-[10px] bg-[#E35D5B]/10 border border-[#E35D5B]/20 text-[#E35D5B] text-xs font-medium">
                {erro}
              </div>
            )}

            {/* Seleção do Atendimento */}
            <div>
              <label className={labelCls}>
                Atendimento <span className="text-[#E35D5B]">*</span>
              </label>
              {isLoading ? (
                <div className="text-xs text-[#87938F]">Carregando atendimentos...</div>
              ) : (
                <select
                  value={atendimentoId}
                  onChange={e => setAtendimentoId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Selecione um atendimento...</option>
                  {atendimentos
                    ?.filter(a => a.status_operacional !== "CANCELADO_CLIENTE" && a.status_operacional !== "CANCELADO_ESTUDIO" && a.status_operacional !== "FINALIZADO")
                    ?.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.cliente?.nome ?? "Sem nome"} - {a.estilo ?? "Sem estilo"} ({a.tipo})
                      </option>
                    ))}
                </select>
              )}
            </div>

            {/* Data e Hora */}
            <div>
              <label className={labelCls}>
                Data e Hora <span className="text-[#E35D5B]">*</span>
              </label>
              <input
                type="datetime-local"
                value={dataSessao}
                onChange={e => setDataSessao(e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Duração */}
            <div>
              <label className={labelCls}>Duração</label>
              <select
                value={duracaoMinutos}
                onChange={e => setDuracaoMinutos(e.target.value)}
                className={inputCls}
              >
                <option value="30">30 minutos</option>
                <option value="60">1 hora</option>
                <option value="90">1 hora e 30 minutos</option>
                <option value="120">2 horas</option>
                <option value="180">3 horas</option>
                <option value="240">4 horas</option>
                <option value="300">5 horas</option>
                <option value="360">6 horas</option>
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#243337]">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-[12px] border border-[#243337] text-[#87938F] hover:text-[#F0EADD] hover:bg-[#102128] text-xs font-semibold transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="inline-flex items-center justify-center h-10 px-5 rounded-[12px] bg-[#2F9285] hover:bg-[#3AA99A] disabled:opacity-50 text-[#050B12] text-xs font-bold transition-all shadow-[0_0_20px_rgba(47,146,133,0.15)]"
            >
              {mutation.isPending ? "Agendando..." : "Confirmar Agendamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
