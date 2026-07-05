"use client";

import { useState } from "react";
import DetalhesAtendimentoModal from "./DetalhesAtendimentoModal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus, Search, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { cn, formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { CurrencyInput } from "@/components/ui/CurrencyInput";

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  SOLICITADO:        { label: "Solicitado",      cls: "bg-info/15 text-info border-info/30" },
  EM_ANALISE:        { label: "Em Análise",       cls: "bg-warning/15 text-warning border-warning/30" },
  AGUARDANDO_SINAL:  { label: "Aguard. Sinal",    cls: "bg-warning/15 text-warning border-warning/30" },
  CONFIRMADO:        { label: "Confirmado",       cls: "bg-success/15 text-success border-success/30" },
  EM_ATENDIMENTO:    { label: "Em Atend.",        cls: "bg-teal-ink/15 text-teal-ink border-teal-ink/30" },
  FINALIZADO:        { label: "Finalizado",       cls: "bg-status-finalizado/15 text-status-finalizado border-status-finalizado/30" },
  REAGENDADO:        { label: "Reagendado",       cls: "bg-info/15 text-info border-info/30" },
  CANCELADO_CLIENTE: { label: "Cancelado",        cls: "bg-error-red/15 text-error-red border-error-red/30" },
  CANCELADO_ESTUDIO: { label: "Cancelado",        cls: "bg-error-red/15 text-error-red border-error-red/30" },
  NAO_COMPARECEU:    { label: "Não Compareceu",   cls: "bg-copper-needle/15 text-copper-needle border-copper-needle/30" },
  RETOQUE:           { label: "Retoque",          cls: "bg-text-subtle/15 text-text-subtle border-text-subtle/30" },
};

const FIN_CONFIG: Record<string, { label: string; cls: string }> = {
  PENDENTE:    { label: "Pendente",    cls: "text-warning" },
  SINAL_PAGO:  { label: "Sinal Pago", cls: "text-info" },
  PAGO_TOTAL:  { label: "Pago",       cls: "text-success" },
  ESTORNADO:   { label: "Estornado",  cls: "text-error-red" },
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
    "w-full h-10 px-3 rounded-[12px] bg-ink-night border border-mist-line text-porcelain-ink text-sm placeholder-text-subtle focus:border-teal-ink/60 outline-none transition-colors";
  const labelCls = "block text-xs font-medium text-text-subtle mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-ink-bg border border-mist-line rounded-[18px] shadow-popover">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mist-line">
          <div>
            <h2 className="text-base font-bold text-porcelain-ink">Novo Atendimento</h2>
            <p className="text-xs text-text-subtle mt-0.5">Preencha os dados do atendimento</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-[10px] text-text-subtle hover:text-porcelain-ink hover:bg-surface-raised transition-all"
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
                Tipo <span className="text-error-red">*</span>
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
                        ? "bg-teal-ink/15 border-teal-ink/50 text-teal-ink"
                        : "bg-ink-night border-mist-line text-text-subtle hover:text-porcelain-ink"
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
                className="w-full px-3 py-2.5 rounded-[12px] bg-ink-night border border-mist-line text-porcelain-ink text-sm placeholder-text-subtle focus:border-teal-ink/60 outline-none transition-colors resize-none"
              />
            </div>

            {/* Valores */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Valor Total (R$)</label>
                <CurrencyInput
                  value={form.valor_total}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, valor_total: v }))}
                  placeholder="0,00"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Valor Sinal (R$)</label>
                <CurrencyInput
                  value={form.valor_sinal}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, valor_sinal: v }))}
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
              <div className="px-3 py-2.5 rounded-[10px] bg-error-red/10 border border-error-red/30 text-sm text-error-red">
                {erro}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-mist-line">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="h-9 px-4 rounded-[12px] text-sm text-text-subtle hover:text-porcelain-ink hover:bg-surface-raised border border-mist-line transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="h-9 px-5 rounded-[12px] text-sm font-semibold bg-teal-ink hover:bg-ink-gold text-ink-night transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {mutation.isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-ink-night/30 border-t-ink-night rounded-full animate-spin" />
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
          <h1 className="text-2xl font-bold text-porcelain-ink">Atendimentos</h1>
          <p className="text-sm text-text-subtle mt-1">
            {isLoading ? "Carregando..." : `${data.length} no total`}
          </p>
        </div>
        <button
          onClick={() => setModalAberto(true)}
          className="flex items-center gap-2 h-10 px-4 rounded-[14px] bg-teal-ink hover:bg-ink-gold text-ink-night font-semibold text-sm transition-all shrink-0"
        >
          <Plus size={16} />
          Novo Atendimento
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por tipo, estilo, parte do corpo..."
            className="w-full h-10 pl-9 pr-4 rounded-[14px] bg-ink-bg border border-mist-line text-porcelain-ink text-sm placeholder-text-subtle focus:outline-none focus:border-teal-ink transition-all"
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
                  ? "bg-teal-ink/15 border-teal-ink/40 text-teal-ink"
                  : "bg-ink-bg border-mist-line text-text-subtle hover:text-porcelain-ink"
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
            <div key={i} className="h-20 bg-ink-bg border border-mist-line rounded-[14px] animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && filtrado.length === 0 && (
        <div className="bg-ink-bg border border-mist-line rounded-[18px]">
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
                  className="flex items-center gap-2 h-11 px-5 rounded-[14px] bg-teal-ink hover:bg-ink-gold text-ink-night font-semibold text-sm transition-colors"
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
            const fin = FIN_CONFIG[a.status_financeiro] ?? { label: a.status_financeiro, cls: "text-text-subtle" };
            return (
              <div
                key={a.id}
                onClick={() => setAtendimentoSelecionado(a)}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-ink-bg border border-mist-line rounded-[14px] hover:border-teal-ink/40 hover:bg-surface-raised transition-all cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-surface-raised rounded-[10px] border border-mist-line shrink-0">
                    <ClipboardList size={16} className="text-teal-ink" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-porcelain-ink">{a.tipo}</p>
                      {a.estilo && <span className="text-xs text-text-subtle">• {a.estilo}</span>}
                      {a.parte_corpo && <span className="text-xs text-text-subtle">• {a.parte_corpo}</span>}
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
                    <p className="text-sm font-bold text-porcelain-ink">
                      {formatCurrency(a.valor_total)}
                    </p>
                  )}
                  <p className="text-xs text-text-subtle">{formatData(a.data_sessao)}</p>
                  <span className="text-xs text-teal-ink">Ver →</span>
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
                        className="p-3 bg-ink-bg border border-mist-line rounded-[14px] hover:border-teal-ink/40 transition-all cursor-pointer"
                      >
                        <p className="text-sm font-medium text-porcelain-ink">{a.tipo}</p>
                        {a.estilo && <p className="text-xs text-text-subtle mt-0.5">{a.estilo}</p>}
                        {a.valor_total && (
                          <p className="text-xs font-bold text-teal-ink mt-1">
                            {formatCurrency(a.valor_total)}
                          </p>
                        )}
                      </div>
                    ))}
                    {items.length === 0 && (
                      <div className="h-20 border border-dashed border-mist-line rounded-[14px] flex items-center justify-center">
                        <p className="text-xs text-text-subtle">Vazio</p>
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
