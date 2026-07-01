"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package, Plus, AlertTriangle, Loader2, X,
  Trash2, Minus, ChevronUp, ChevronDown,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { cn, formatCurrency, formatQuantity, getQuantityStep } from "@/lib/utils";
import { CurrencyInput } from "@/components/ui/CurrencyInput";

interface EstoqueItem {
  id: string;
  nome: string;
  categoria: "TINTA" | "AGULHA" | "LUVA" | "PAPEL" | "PRODUTO" | "OUTRO";
  unidade: string;
  quantidade_atual: number;
  quantidade_minima: number;
  preco_custo: number | null;
  ativo: boolean;
  alerta_minimo: boolean;
}

const CATEGORIA_CONFIG: Record<string, { label: string; cls: string }> = {
  TINTA:    { label: "Tinta",    cls: "bg-info/15 text-info border-info/30" },
  AGULHA:   { label: "Agulha",  cls: "bg-copper-needle/15 text-copper-needle border-copper-needle/30" },
  LUVA:     { label: "Luva",    cls: "bg-success/15 text-success border-success/30" },
  PAPEL:    { label: "Papel",   cls: "bg-text-subtle/15 text-text-subtle border-text-subtle/30" },
  PRODUTO:  { label: "Produto", cls: "bg-status-finalizado/15 text-status-finalizado border-status-finalizado/30" },
  OUTRO:    { label: "Outro",   cls: "bg-mist-line/60 text-text-subtle border-mist-line" },
};

const UNIDADES = ["un", "cx", "pct", "ml", "g", "kg", "L", "par", "rolo"];

export default function EstoquePage() {
  const qc = useQueryClient();

  // Modal de novo item
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Modal de movimentação de quantidade
  const [movItem, setMovItem] = useState<EstoqueItem | null>(null);
  const [delta, setDelta] = useState("");
  const [deltaDir, setDeltaDir] = useState<"entrada" | "saida">("entrada");
  const [movLoading, setMovLoading] = useState(false);
  const [movError, setMovError] = useState<string | null>(null);

  // Campos do formulário de novo item
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("TINTA");
  const [unidade, setUnidade] = useState("un");
  const [quantAtual, setQuantAtual] = useState("0");
  const [quantMin, setQuantMin] = useState("0");
  const [precoCusto, setPrecoCusto] = useState("");

  const { data: itens = [], isLoading } = useQuery<EstoqueItem[]>({
    queryKey: ["estoque"],
    queryFn: () => api.get("/api/v1/estoque/"),
  });

  const { data: alertas = [] } = useQuery<EstoqueItem[]>({
    queryKey: ["estoque-alertas"],
    queryFn: () => api.get("/api/v1/estoque/alertas"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/estoque/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estoque"] });
      qc.invalidateQueries({ queryKey: ["estoque-alertas"] });
    },
  });

  const quantMutation = useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) =>
      api.patch(`/api/v1/estoque/${id}/quantidade`, { delta }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estoque"] });
      qc.invalidateQueries({ queryKey: ["estoque-alertas"] });
    },
  });

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setNome(""); setCategoria("TINTA"); setUnidade("un");
    setQuantAtual("0"); setQuantMin("0"); setPrecoCusto("");
    setErrorText(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    if (!nome.trim()) { setErrorText("Informe o nome do item."); return; }

    setLoading(true);
    try {
      await api.post("/api/v1/estoque/", {
        nome: nome.trim(),
        categoria,
        unidade,
        quantidade_atual: parseFloat(quantAtual) || 0,
        quantidade_minima: parseFloat(quantMin) || 0,
        preco_custo: precoCusto ? parseFloat(precoCusto) : null,
      });
      qc.invalidateQueries({ queryKey: ["estoque"] });
      qc.invalidateQueries({ queryKey: ["estoque-alertas"] });
      setIsModalOpen(false);
    } catch (err: any) {
      setErrorText(err.message ?? "Erro ao salvar item.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenMov = (item: EstoqueItem) => {
    setMovItem(item);
    setDelta("");
    setDeltaDir("entrada");
    setMovError(null);
  };

  const handleMovSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movItem) return;
    const val = parseFloat(delta);
    if (isNaN(val) || val <= 0) { setMovError("Informe uma quantidade válida."); return; }

    setMovLoading(true);
    try {
      await quantMutation.mutateAsync({
        id: movItem.id,
        delta: deltaDir === "saida" ? -val : val,
      });
      setMovItem(null);
    } catch (err: any) {
      setMovError(err.message ?? "Erro na movimentação.");
    } finally {
      setMovLoading(false);
    }
  };

  // formatCurrency e formatQuantity vêm de utils

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-porcelain-ink">Estoque</h1>
          <p className="text-sm text-text-subtle mt-1">
            {isLoading ? "Carregando..." : `${itens.length} item${itens.length !== 1 ? "s" : ""} cadastrado${itens.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={handleOpenModal}
          className="flex items-center gap-2 h-10 px-4 rounded-[14px] bg-teal-ink hover:bg-ink-gold text-ink-night font-semibold text-sm transition-all shrink-0"
        >
          <Plus size={16} />
          Novo Item
        </button>
      </div>

      {/* Alertas de mínimo — só mostra se houver */}
      {alertas.length > 0 && (
        <div className="p-4 mb-6 rounded-[14px] bg-warning/10 border border-warning/30">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-warning shrink-0" />
            <p className="text-sm font-semibold text-warning">
              {alertas.length} item{alertas.length !== 1 ? "s" : ""} abaixo do mínimo
            </p>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {alertas.map((a) => (
              <span key={a.id} className="text-xs px-2.5 py-1 rounded-full bg-warning/15 text-warning border border-warning/30 font-medium">
                {a.nome} — {formatQuantity(a.quantidade_atual, a.unidade)} {a.unidade}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sem alertas */}
      {!isLoading && alertas.length === 0 && itens.length > 0 && (
        <div className="flex items-center gap-3 p-3 mb-6 rounded-[12px] bg-success/5 border border-success/20 text-sm text-success">
          <Package size={14} className="shrink-0" />
          Todos os itens estão dentro do estoque mínimo.
        </div>
      )}

      {/* Skeleton loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-ink-bg border border-mist-line rounded-[14px] animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && itens.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-ink-bg border border-mist-line rounded-[18px]">
          <Package size={48} className="text-mist-line mb-4" />
          <h3 className="text-porcelain-ink font-semibold mb-2">Nenhum item cadastrado</h3>
          <p className="text-sm text-text-subtle max-w-xs mb-6">
            Cadastre tintas, agulhas, luvas e outros insumos. Receba alertas quando o estoque estiver baixo.
          </p>
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 h-10 px-5 rounded-[14px] bg-teal-ink hover:bg-ink-gold text-ink-night font-semibold text-sm"
          >
            <Plus size={16} />
            Adicionar Item
          </button>
        </div>
      )}

      {/* Lista de itens */}
      {!isLoading && itens.length > 0 && (
        <>
        {/* Mobile: cards legíveis (sem zoom) */}
        <div className="space-y-2.5 lg:hidden">
          {itens.map((item) => (
            <div
              key={item.id}
              className={cn(
                "bg-ink-bg border rounded-[16px] p-4",
                item.alerta_minimo ? "border-warning/40" : "border-mist-line"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  {item.alerta_minimo && (
                    <AlertTriangle size={15} className="text-warning shrink-0" />
                  )}
                  <span className="truncate text-[15px] font-semibold text-porcelain-ink">
                    {item.nome}
                  </span>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                    CATEGORIA_CONFIG[item.categoria]?.cls
                  )}
                >
                  {CATEGORIA_CONFIG[item.categoria]?.label ?? item.categoria}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-[10px] bg-surface-raised py-2">
                  <p className="text-[11px] text-text-subtle">Atual</p>
                  <p
                    className={cn(
                      "text-sm font-bold tabular-nums",
                      item.alerta_minimo ? "text-warning" : "text-porcelain-ink"
                    )}
                  >
                    {formatQuantity(item.quantidade_atual, item.unidade)} {item.unidade}
                  </p>
                </div>
                <div className="rounded-[10px] bg-surface-raised py-2">
                  <p className="text-[11px] text-text-subtle">Mínimo</p>
                  <p className="text-sm font-semibold tabular-nums text-porcelain-ink">
                    {formatQuantity(item.quantidade_minima, item.unidade)} {item.unidade}
                  </p>
                </div>
                <div className="rounded-[10px] bg-surface-raised py-2">
                  <p className="text-[11px] text-text-subtle">Custo</p>
                  <p className="text-sm font-semibold tabular-nums text-porcelain-ink">
                    {formatCurrency(item.preco_custo)}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleOpenMov(item)}
                  className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[12px] border border-teal-ink/20 bg-teal-ink/10 text-sm font-semibold text-teal-ink active:scale-[0.98]"
                >
                  <ChevronUp size={15} /> Movimentar
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Arquivar "${item.nome}"?`)) {
                      deleteMutation.mutate(item.id);
                    }
                  }}
                  title="Arquivar item"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-error-red/10 bg-error-red/5 text-error-red/70 hover:text-error-red active:scale-[0.98]"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: tabela */}
        <div className="hidden lg:block bg-ink-bg border border-mist-line rounded-[18px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-mist-line bg-surface-raised/50 text-[11px] font-bold uppercase tracking-wider text-text-subtle">
                  <th className="px-5 py-3">Item</th>
                  <th className="px-5 py-3">Categoria</th>
                  <th className="px-5 py-3 text-center">Atual</th>
                  <th className="px-5 py-3 text-center">Mínimo</th>
                  <th className="px-5 py-3 text-right">Custo unit.</th>
                  <th className="px-5 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist-line/50 text-sm">
                {itens.map((item) => (
                  <tr
                    key={item.id}
                    className={cn(
                      "hover:bg-surface-raised/30 transition-all",
                      item.alerta_minimo && "bg-warning/3"
                    )}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {item.alerta_minimo && (
                          <AlertTriangle size={13} className="text-warning shrink-0" />
                        )}
                        <span className="font-medium text-porcelain-ink">{item.nome}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                        CATEGORIA_CONFIG[item.categoria]?.cls
                      )}>
                        {CATEGORIA_CONFIG[item.categoria]?.label ?? item.categoria}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={cn(
                        "font-bold tabular-nums",
                        item.alerta_minimo ? "text-warning" : "text-porcelain-ink"
                      )}>
                        {formatQuantity(item.quantidade_atual, item.unidade)} {item.unidade}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center text-text-subtle">
                      {formatQuantity(item.quantidade_minima, item.unidade)} {item.unidade}
                    </td>
                    <td className="px-5 py-3 text-right text-text-subtle">
                      {formatCurrency(item.preco_custo)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenMov(item)}
                          title="Movimentar estoque"
                          className="p-1.5 rounded-[8px] bg-teal-ink/10 hover:bg-teal-ink/25 text-teal-ink border border-teal-ink/20 transition-all"
                        >
                          <ChevronUp size={13} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Arquivar "${item.nome}"?`)) {
                              deleteMutation.mutate(item.id);
                            }
                          }}
                          title="Arquivar item"
                          className="p-1.5 rounded-[8px] bg-error-red/5 hover:bg-error-red/15 text-error-red/60 hover:text-error-red border border-error-red/10 transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {/* ─── Modal Novo Item ─── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-ink-bg border border-mist-line w-full max-w-md rounded-[18px] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-mist-line">
              <div className="flex items-center gap-2">
                <Package size={18} className="text-teal-ink" />
                <h2 className="text-porcelain-ink font-bold text-base">Novo Item de Estoque</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-text-subtle hover:text-porcelain-ink">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {errorText && (
                <div className="p-3 bg-error-red/10 border border-error-red/20 text-error-red text-xs rounded-lg flex items-center justify-between">
                  <span>{errorText}</span>
                  <button type="button" onClick={() => setErrorText(null)}><X size={14} /></button>
                </div>
              )}

              {/* Nome */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-subtle">Nome *</label>
                <input
                  type="text" required
                  placeholder="Ex: Tinta Dynamic Preta, Agulha Magnum 11"
                  value={nome} onChange={(e) => setNome(e.target.value)}
                  className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-mist-line text-sm text-porcelain-ink focus:border-teal-ink/60 outline-none transition-all"
                />
              </div>

              {/* Categoria + Unidade */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-subtle">Categoria</label>
                  <select
                    value={categoria} onChange={(e) => setCategoria(e.target.value)}
                    className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-mist-line text-sm text-porcelain-ink focus:border-teal-ink/60 outline-none transition-all"
                  >
                    <option value="TINTA">Tinta</option>
                    <option value="AGULHA">Agulha</option>
                    <option value="LUVA">Luva</option>
                    <option value="PAPEL">Papel</option>
                    <option value="PRODUTO">Produto</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-subtle">Unidade</label>
                  <select
                    value={unidade} onChange={(e) => setUnidade(e.target.value)}
                    className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-mist-line text-sm text-porcelain-ink focus:border-teal-ink/60 outline-none transition-all"
                  >
                    {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              {/* Qtd Atual + Mínima */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-subtle">Qtd. Atual</label>
                  <input
                    type="number" step={getQuantityStep(unidade)} min="0"
                    placeholder="0"
                    value={quantAtual} onChange={(e) => setQuantAtual(e.target.value)}
                    className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-mist-line text-sm text-porcelain-ink focus:border-teal-ink/60 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-subtle">Qtd. Mínima</label>
                  <input
                    type="number" step={getQuantityStep(unidade)} min="0"
                    placeholder="0"
                    value={quantMin} onChange={(e) => setQuantMin(e.target.value)}
                    className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-mist-line text-sm text-porcelain-ink focus:border-teal-ink/60 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Preço de custo */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-subtle">Preço de Custo (R$) — opcional</label>
                <CurrencyInput
                  placeholder="Ex: 35,90"
                  value={precoCusto} onValueChange={setPrecoCusto}
                  className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-mist-line text-sm text-porcelain-ink focus:border-teal-ink/60 outline-none transition-all"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-mist-line">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 h-10 rounded-[12px] border border-mist-line hover:bg-surface-raised text-porcelain-ink font-semibold text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit" disabled={loading}
                  className="flex-1 h-10 rounded-[12px] bg-teal-ink hover:bg-ink-gold disabled:opacity-60 text-ink-night font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={15} className="animate-spin" />}
                  {loading ? "Salvando..." : "Cadastrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal Movimentação de Quantidade ─── */}
      {movItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-ink-bg border border-mist-line w-full max-w-sm rounded-[18px] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-mist-line">
              <h2 className="text-porcelain-ink font-bold text-sm">Movimentar: {movItem.nome}</h2>
              <button onClick={() => setMovItem(null)} className="text-text-subtle hover:text-porcelain-ink">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleMovSubmit} className="p-5 space-y-4">
              {movError && (
                <div className="p-3 bg-error-red/10 border border-error-red/20 text-error-red text-xs rounded-lg">
                  {movError}
                </div>
              )}

              {/* Atual */}
              <div className="flex items-center justify-between p-3 bg-ink-night rounded-[10px] border border-mist-line">
                <span className="text-xs text-text-subtle">Quantidade atual</span>
                <span className="font-bold text-porcelain-ink tabular-nums">
                  {movItem.quantidade_atual} {movItem.unidade}
                </span>
              </div>

              {/* Direção */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDeltaDir("entrada")}
                  className={cn(
                    "h-10 rounded-[10px] text-sm font-semibold flex items-center justify-center gap-1.5 border transition-all",
                    deltaDir === "entrada"
                      ? "bg-success/15 text-success border-success/40"
                      : "bg-transparent text-text-subtle border-mist-line hover:bg-surface-raised"
                  )}
                >
                  <ChevronUp size={14} /> Entrada
                </button>
                <button
                  type="button"
                  onClick={() => setDeltaDir("saida")}
                  className={cn(
                    "h-10 rounded-[10px] text-sm font-semibold flex items-center justify-center gap-1.5 border transition-all",
                    deltaDir === "saida"
                      ? "bg-error-red/15 text-error-red border-error-red/40"
                      : "bg-transparent text-text-subtle border-mist-line hover:bg-surface-raised"
                  )}
                >
                  <Minus size={14} /> Saída
                </button>
              </div>

              {/* Quantidade */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-subtle">
                  Quantidade ({movItem.unidade})
                </label>
                <input
                  type="number" step={getQuantityStep(movItem.unidade)} min={getQuantityStep(movItem.unidade)} required
                  placeholder="Ex: 10"
                  value={delta} onChange={(e) => setDelta(e.target.value)}
                  className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-mist-line text-sm text-porcelain-ink focus:border-teal-ink/60 outline-none transition-all"
                  autoFocus
                />
              </div>

              {/* Preview do novo total */}
              {delta && !isNaN(parseFloat(delta)) && (
                <div className="flex items-center justify-between p-3 bg-ink-night rounded-[10px] border border-teal-ink/20">
                  <span className="text-xs text-text-subtle">Novo total</span>
                  <span className="font-bold text-teal-ink tabular-nums">
                    {formatQuantity(
                      movItem.quantidade_atual + (deltaDir === "saida" ? -parseFloat(delta) : parseFloat(delta)),
                      movItem.unidade
                    )} {movItem.unidade}
                  </span>
                </div>
              )}

              <div className="flex gap-3 pt-2 border-t border-mist-line">
                <button
                  type="button" onClick={() => setMovItem(null)}
                  className="flex-1 h-10 rounded-[12px] border border-mist-line hover:bg-surface-raised text-porcelain-ink font-semibold text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit" disabled={movLoading}
                  className="flex-1 h-10 rounded-[12px] bg-teal-ink hover:bg-ink-gold disabled:opacity-60 text-ink-night font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  {movLoading && <Loader2 size={15} className="animate-spin" />}
                  {movLoading ? "Salvando..." : "Confirmar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
