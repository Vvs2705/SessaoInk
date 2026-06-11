"use client";

import { useState } from "react";
import DetalhesAtendimentoModal from "./DetalhesAtendimentoModal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus, Search, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { cn, formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  SOLICITADO:        { label: "Solicitado",      cls: "bg-[#5E9ED6]/15 text-[#5E9ED6] border-[#5E9ED6]/30" },
  EM_ANALISE:        { label: "Em Análise",       cls: "bg-[#D99A3D]/15 text-[#D99A3D] border-[#D99A3D]/30" },
  AGUARDANDO_SINAL:  { label: "Aguard. Sinal",    cls: "bg-[#D99A3D]/15 text-[#D99A3D] border-[#D99A3D]/30" },
  CONFIRMADO:        { label: "Confirmado",       cls: "bg-[#54B88D]/15 text-[#54B88D] border-[#54B88D]/30" },
  EM_ATENDIMENTO:    { label: "Em Atend.",        cls: "bg-[#2F9285]/15 text-[#2F9285] border-[#2F9285]/30" },
  FINALIZADO:        { label: "Finalizado",       cls: "bg-[#8B7CF6]/15 text-[#8B7CF6] border-[#8B7CF6]/30" },
  REAGENDADO:        { label: "Reagendado",       cls: "bg-[#5E9ED6]/15 text-[#5E9ED6] border-[#5E9ED6]/30" },
  CANCELADO_CLIENTE: { label: "Cancelado",        cls: "bg-[#E35D5B]/15 text-[#E35D5B] border-[#E35D5B]/30" },
  CANCELADO_ESTUDIO: { label: "Cancelado",        cls: "bg-[#E35D5B]/15 text-[#E35D5B] border-[#E35D5B]/30" },
  NAO_COMPARECEU:    { label: "Não Compareceu",   cls: "bg-[#C36B3F]/15 text-[#C36B3F] border-[#C36B3F]/30" },
  RETOQUE:           { label: "Retoque",          cls: "bg-[#87938F]/15 text-[#87938F] border-[#87938F]/30" },
};

const FIN_CONFIG: Record<string, { label: string; cls: string }> = {
  PENDENTE:    { label: "Pendente",    cls: "text-[#D99A3D]" },
  SINAL_PAGO:  { label: "Sinal Pago", cls: "text-[#5E9ED6]" },
  PAGO_TOTAL:  { label: "Pago",       cls: "text-[#54B88D]" },
  ESTORNADO:   { label: "Estornado",  cls: "text-[#E35D5B]" },
};

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
  datas_preferidas: { data: string; periodo: string }[] | null;
  horario_personalizado: string | null;
  cliente: ClienteAtendimento | null;
}

interface NovoAtendimentoForm {
  tipo: string;
  estilo: string;
  parte_corpo: string;
  descricao: string;
  valor_total: string;
  valor_sinal: string;
  forma_pagamento: string;
}

const TIPOS = ["TATUAGEM", "CONSULTA", "RETOQUE", "FLASH"] as const;

const FORMAS_PAGAMENTO = [
  { value: "PIX",            label: "PIX" },
  { value: "DINHEIRO",       label: "Dinheiro" },
  { value: "CARTAO_DEBITO",  label: "Cartão de Débito" },
  { value: "CARTAO_CREDITO", label: "Cartão de Crédito" },
  { value: "TRANSFERENCIA",  label: "Transferência" },
  { value: "OUTRO",          label: "Outro" },
] as const;

const FORM_INICIAL: NovoAtendimentoForm = {
  tipo: "TATUAGEM",
  estilo: "",
  parte_corpo: "",
  descricao: "",
  valor_total: "",
  valor_sinal: "",
  forma_pagamento: "PIX",
};

function NovoAtendimentoModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<NovoAtendimentoForm>(FORM_INICIAL);
  const [erro, setErro] = useState<string | null>(null);

  const setField =
    (field: keyof NovoAtendimentoForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post("/api/v1/atendimentos/", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["atendimentos"] });
      onClose();
    },
    onError: (err: Error) => {
      setErro(err.message || "Erro ao criar atendimento.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    const payload: Record<string, unknown> = {
      tipo: form.tipo,
      forma_pagamento: form.forma_pagamento,
    };
    if (form.estilo.trim())      payload.estilo      = form.estilo.trim();
    if (form.parte_corpo.trim()) payload.parte_corpo = form.parte_corpo.trim();
    if (form.descricao.trim())   payload.descricao   = form.descricao.trim();
    if (form.valor_total.trim()) payload.valor_total = parseFloat(form.valor_total);
    if (form.valor_sinal.trim()) payload.valor_sinal = parseFloat(form.valor_sinal);
    mutation.mutate(payload);
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
            <h2 className="text-base font-bold text-[#F0EADD]">Novo Atendimento</h2>
            <p className="text-xs text-[#87938F] mt-0.5">Preencha os dados do atendimento</p>
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
          <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
            {/* Tipo */}
            <div>
              <label className={labelCls}>
                Tipo <span className="text-[#E35D5B]">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TIPOS.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, tipo: t }))}
                    className={cn(
                      "h-9 rounded-[10px] text-xs font-semibold border transition-all",
                      form.tipo === t
                        ? "bg-[#2F9285]/15 border-[#2F9285]/50 text-[#2F9285]"
                        : "bg-[#050B12] border-[#243337] text-[#87938F] hover:text-[#F0EADD]"
                    )}
                  >
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Estilo + Parte do corpo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Estilo</label>
                <input
                  value={form.estilo}
                  onChange={setField("estilo")}
                  placeholder="Ex: Realismo, Old School"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Parte do corpo</label>
                <input
                  value={form.parte_corpo}
                  onChange={setField("parte_corpo")}
                  placeholder="Ex: Braço, Costas"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Descrição */}
            <div>
              <label className={labelCls}>Descrição</label>
              <textarea
                value={form.descricao}
                onChange={setField("descricao")}
                placeholder="Descreva o atendimento, referências, detalhes..."
                rows={3}
                className="w-full px-3 py-2.5 rounded-[12px] bg-[#050B12] border border-[#243337] text-[#F0EADD] text-sm placeholder-[#87938F] focus:border-[#2F9285]/60 outline-none transition-colors resize-none"
              />
            </div>

            {/* Valores */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Valor Total (R$)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.valor_total}
                  onChange={setField("valor_total")}
                  placeholder="0,00"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Valor Sinal (R$)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.valor_sinal}
                  onChange={setField("valor_sinal")}
                  placeholder="0,00"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Forma de pagamento */}
            <div>
              <label className={labelCls}>Forma de Pagamento</label>
              <select
                value={form.forma_pagamento}
                onChange={setField("forma_pagamento")}
                className={cn(inputCls, "cursor-pointer")}
              >
                {FORMAS_PAGAMENTO.map(fp => (
                  <option key={fp.value} value={fp.value}>
                    {fp.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Erro */}
            {erro && (
              <div className="px-3 py-2.5 rounded-[10px] bg-[#E35D5B]/10 border border-[#E35D5B]/30 text-sm text-[#E35D5B]">
                {erro}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#243337]">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="h-9 px-4 rounded-[12px] text-sm text-[#87938F] hover:text-[#F0EADD] hover:bg-[#102128] border border-[#243337] transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="h-9 px-5 rounded-[12px] text-sm font-semibold bg-[#2F9285] hover:bg-[#3AA99A] text-[#050B12] transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {mutation.isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-[#050B12]/30 border-t-[#050B12] rounded-full animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Plus size={15} />
                  Criar Atendimento
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AtendimentosPage() {
  const [view, setView] = useState<"lista" | "kanban">("lista");
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [atendimentoSelecionado, setAtendimentoSelecionado] = useState<Atendimento | null>(null);

  const { data = [], isLoading } = useQuery<Atendimento[]>({
    queryKey: ["atendimentos"],
    queryFn: () => api.get("/api/v1/atendimentos/"),
  });

  const filtrado = data.filter(a =>
    !busca ||
    [a.tipo, a.estilo, a.parte_corpo].some(v =>
      v?.toLowerCase().includes(busca.toLowerCase())
    )
  );

  const formatData = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EADD]">Atendimentos</h1>
          <p className="text-sm text-[#87938F] mt-1">
            {isLoading ? "Carregando..." : `${data.length} no total`}
          </p>
        </div>
        <button
          onClick={() => setModalAberto(true)}
          className="flex items-center gap-2 h-10 px-4 rounded-[14px] bg-[#2F9285] hover:bg-[#3AA99A] text-[#050B12] font-semibold text-sm transition-all shrink-0"
        >
          <Plus size={16} />
          Novo Atendimento
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#87938F]" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por tipo, estilo, parte do corpo..."
            className="w-full h-10 pl-9 pr-4 rounded-[14px] bg-[#0B171C] border border-[#243337] text-[#F0EADD] text-sm placeholder-[#87938F] focus:outline-none focus:border-[#2F9285] transition-all"
          />
        </div>
        <div className="flex gap-2">
          {(["lista", "kanban"] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "h-10 px-4 rounded-[14px] text-sm font-medium border transition-all capitalize",
                view === v
                  ? "bg-[#2F9285]/15 border-[#2F9285]/40 text-[#2F9285]"
                  : "bg-[#0B171C] border-[#243337] text-[#87938F] hover:text-[#F0EADD]"
              )}
            >
              {v === "lista" ? "Lista" : "Kanban"}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-[#0B171C] border border-[#243337] rounded-[14px] animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && filtrado.length === 0 && (
        <div className="bg-[#0B171C] border border-[#243337] rounded-[18px]">
          <EmptyState
            title={busca ? "Nenhum resultado encontrado" : "Nenhum atendimento por aqui ainda"}
            description={
              busca
                ? "Tente outros termos de busca."
                : "Os pedidos do seu portal público chegam aqui automaticamente — ou crie um atendimento manualmente."
            }
            action={
              !busca ? (
                <button
                  onClick={() => setModalAberto(true)}
                  className="flex items-center gap-2 h-11 px-5 rounded-[14px] bg-[#2F9285] hover:bg-[#3AA99A] text-[#050B12] font-semibold text-sm transition-colors"
                >
                  <Plus size={16} />
                  Criar atendimento
                </button>
              ) : undefined
            }
          />
        </div>
      )}

      {/* Lista */}
      {!isLoading && filtrado.length > 0 && view === "lista" && (
        <div className="space-y-2">
          {filtrado.map(a => {
            const st = STATUS_CONFIG[a.status_operacional] ?? { label: a.status_operacional, cls: "" };
            const fin = FIN_CONFIG[a.status_financeiro] ?? { label: a.status_financeiro, cls: "text-[#87938F]" };
            return (
              <div
                key={a.id}
                onClick={() => setAtendimentoSelecionado(a)}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#0B171C] border border-[#243337] rounded-[14px] hover:border-[#2F9285]/40 hover:bg-[#102128] transition-all cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-[#102128] rounded-[10px] border border-[#243337] shrink-0">
                    <ClipboardList size={16} className="text-[#2F9285]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[#F0EADD]">{a.tipo}</p>
                      {a.estilo && <span className="text-xs text-[#87938F]">• {a.estilo}</span>}
                      {a.parte_corpo && <span className="text-xs text-[#87938F]">• {a.parte_corpo}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border", st.cls)}>
                        {st.label}
                      </span>
                      <span className={cn("text-[10px] font-medium", fin.cls)}>
                        {fin.label}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-right">
                  {a.valor_total && (
                    <p className="text-sm font-bold text-[#F0EADD]">
                      {formatCurrency(a.valor_total)}
                    </p>
                  )}
                  <p className="text-xs text-[#87938F]">{formatData(a.data_sessao)}</p>
                  <span className="text-xs text-[#2F9285]">Ver →</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Kanban */}
      {!isLoading && view === "kanban" && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {["SOLICITADO", "AGUARDANDO_SINAL", "CONFIRMADO", "FINALIZADO"].map(col => {
              const items = filtrado.filter(a => a.status_operacional === col);
              const cfg = STATUS_CONFIG[col];
              return (
                <div key={col} className="w-64 shrink-0">
                  <div className={cn("text-[10px] font-bold uppercase px-3 py-1.5 rounded-full border mb-3 inline-block", cfg?.cls)}>
                    {cfg?.label} {items.length > 0 && `(${items.length})`}
                  </div>
                  <div className="space-y-2">
                    {items.map(a => (
                      <div
                        key={a.id}
                        onClick={() => setAtendimentoSelecionado(a)}
                        className="p-3 bg-[#0B171C] border border-[#243337] rounded-[14px] hover:border-[#2F9285]/40 transition-all cursor-pointer"
                      >
                        <p className="text-sm font-medium text-[#F0EADD]">{a.tipo}</p>
                        {a.estilo && <p className="text-xs text-[#87938F] mt-0.5">{a.estilo}</p>}
                        {a.valor_total && (
                          <p className="text-xs font-bold text-[#2F9285] mt-1">
                            {formatCurrency(a.valor_total)}
                          </p>
                        )}
                      </div>
                    ))}
                    {items.length === 0 && (
                      <div className="h-20 border border-dashed border-[#243337] rounded-[14px] flex items-center justify-center">
                        <p className="text-xs text-[#87938F]">Vazio</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal */}
      {modalAberto && <NovoAtendimentoModal onClose={() => setModalAberto(false)} />}
      {atendimentoSelecionado && (
        <DetalhesAtendimentoModal
          atendimento={atendimentoSelecionado}
          onClose={() => setAtendimentoSelecionado(null)}
        />
      )}
    </div>
  );
}
