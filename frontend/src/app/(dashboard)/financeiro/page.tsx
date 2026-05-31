"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet, TrendingUp, Clock, Plus, Loader2, X, Calendar, DollarSign, CreditCard, Check, Trash2, Edit2, RefreshCw, AlertCircle } from "lucide-react";
import { api } from "@/lib/api/client";
import { cn, formatCurrency } from "@/lib/utils";

interface ResumoFinanceiro {
  receita_mes: number;
  sinais_pendentes: number;
  ticket_medio: number;
}

interface LancamentoItem {
  id: string;
  tipo: "ENTRADA" | "SAIDA" | "COMISSAO" | "SINAL";
  descricao: string | null;
  valor: number;
  status: "PENDENTE" | "PAGO" | "CANCELADO" | "ESTORNADO";
  forma_pagamento: "PIX" | "DINHEIRO" | "CARTAO_DEBITO" | "CARTAO_CREDITO" | "TRANSFERENCIA" | "OUTRO" | null;
  data_prevista: string | null;
  data_realizada: string | null;
}

const PAYMENT_LABELS: Record<string, string> = {
  PIX: "Pix",
  DINHEIRO: "Dinheiro",
  CARTAO_DEBITO: "Cartão de Débito",
  CARTAO_CREDITO: "Cartão de Crédito",
  TRANSFERENCIA: "Transferência",
  OUTRO: "Outro",
};

const STATUS_LABELS: Record<string, string> = {
  PENDENTE: "Pendente",
  PAGO: "Pago",
  CANCELADO: "Cancelado",
  ESTORNADO: "Estornado",
};

const STATUS_COLORS: Record<string, string> = {
  PENDENTE: "text-[#D99A3D] bg-[#D99A3D]/10 border-[#D99A3D]/20",
  PAGO: "text-[#54B88D] bg-[#54B88D]/10 border-[#54B88D]/20",
  CANCELADO: "text-[#E35D5B] bg-[#E35D5B]/10 border-[#E35D5B]/20",
  ESTORNADO: "text-[#C36B3F] bg-[#C36B3F]/10 border-[#C36B3F]/20",
};

const TYPE_CONFIG: Record<string, { label: string; cls: string }> = {
  ENTRADA: { label: "Entrada", cls: "text-[#54B88D]" },
  SAIDA: { label: "Saída", cls: "text-[#E35D5B]" },
  COMISSAO: { label: "Comissão", cls: "text-[#8B7CF6]" },
  SINAL: { label: "Sinal", cls: "text-[#5E9ED6]" },
};

export default function FinanceiroPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"entradas" | "pendencias" | "resumo">("resumo");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<LancamentoItem | null>(null);

  // Form states
  const [tipo, setTipo] = useState<"ENTRADA" | "SAIDA" | "COMISSAO" | "SINAL">("ENTRADA");
  const [status, setStatus] = useState<"PENDENTE" | "PAGO" | "CANCELADO" | "ESTORNADO">("PAGO");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [dataPrevista, setDataPrevista] = useState("");

  const {
    data: resumo,
    isLoading: isLoadingResumo,
    isError: isErrorResumo,
    refetch: refetchResumo,
  } = useQuery<ResumoFinanceiro>({
    queryKey: ["financeiro-resumo"],
    queryFn: () => api.get("/api/v1/financeiro/resumo"),
    refetchOnMount: true,
  });

  const {
    data: lancamentos = [],
    isLoading: isLoadingLancamentos,
    isError: isErrorLancamentos,
    refetch: refetchLancamentos,
  } = useQuery<LancamentoItem[]>({
    queryKey: ["financeiro-lancamentos"],
    queryFn: () => api.get("/api/v1/financeiro/"),
    refetchOnMount: true,
  });

  const isError = isErrorResumo || isErrorLancamentos;
  const handleRefresh = () => {
    refetchResumo();
    refetchLancamentos();
  };

  const addLancamentoMutation = useMutation({
    mutationFn: (dados: any) => api.post("/api/v1/financeiro/", dados),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro-resumo"] });
      qc.invalidateQueries({ queryKey: ["financeiro-lancamentos"] });
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      setErrorText(err.message ?? "Erro ao salvar lançamento.");
    },
  });

  const updateLancamentoMutation = useMutation({
    mutationFn: ({ id, ...dados }: { id: string; [key: string]: any }) =>
      api.patch(`/api/v1/financeiro/${id}`, dados),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro-resumo"] });
      qc.invalidateQueries({ queryKey: ["financeiro-lancamentos"] });
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      setErrorText(err.message ?? "Erro ao atualizar lançamento.");
    },
  });

  const deleteLancamentoMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/financeiro/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro-resumo"] });
      qc.invalidateQueries({ queryKey: ["financeiro-lancamentos"] });
    },
    onError: (err: any) => {
      alert(err.message ?? "Erro ao deletar lançamento.");
    },
  });

  const handleOpenModal = () => {
    setEditingItem(null);
    setTipo("ENTRADA");
    setStatus("PAGO");
    setDescricao("");
    setValor("");
    setFormaPagamento("PIX");
    setDataPrevista(new Date().toISOString().split("T")[0]);
    setIsModalOpen(true);
    setErrorText(null);
  };

  const handleEditClick = (item: LancamentoItem) => {
    setEditingItem(item);
    setTipo(item.tipo);
    setStatus(item.status);
    setDescricao(item.descricao || "");
    setValor(String(item.valor));
    setFormaPagamento(item.forma_pagamento || "PIX");
    setDataPrevista(item.data_prevista ? new Date(item.data_prevista).toISOString().split("T")[0] : "");
    setIsModalOpen(true);
    setErrorText(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);

    const valNum = parseFloat(valor);
    if (isNaN(valNum) || valNum <= 0) {
      setErrorText("Valor deve ser maior que zero.");
      return;
    }

    if (editingItem) {
      updateLancamentoMutation.mutate({
        id: editingItem.id,
        tipo,
        status,
        descricao: descricao.trim() || "",
        valor: valNum,
        forma_pagamento: formaPagamento || undefined,
        data_prevista: dataPrevista ? new Date(dataPrevista).toISOString() : undefined,
      });
    } else {
      addLancamentoMutation.mutate({
        tipo,
        status,
        descricao: descricao.trim() || undefined,
        valor: valNum,
        forma_pagamento: formaPagamento || undefined,
        data_prevista: dataPrevista ? new Date(dataPrevista).toISOString() : undefined,
      });
    }
  };

  const isSaving = addLancamentoMutation.isPending || updateLancamentoMutation.isPending;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("pt-BR", { timeZone: "UTC" });
  };

  // Filtering transactions
  const filteredLancamentos = lancamentos.filter((l) => {
    if (activeTab === "entradas") {
      return l.tipo === "ENTRADA" || l.tipo === "SINAL";
    }
    if (activeTab === "pendencias") {
      return l.status === "PENDENTE";
    }
    return true;
  });

  const cards = [
    {
      label: "Receita do Mês",
      value: formatCurrency(resumo?.receita_mes ?? 0),
      icon: TrendingUp,
      color: "text-[#54B88D]",
    },
    {
      label: "Sinais Pendentes",
      value: formatCurrency(resumo?.sinais_pendentes ?? 0),
      icon: Clock,
      color: "text-[#D99A3D]",
    },
    {
      label: "Ticket Médio",
      value: formatCurrency(resumo?.ticket_medio ?? 0),
      icon: Wallet,
      color: "text-[#5E9ED6]",
    },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EADD]">Financeiro</h1>
          <p className="text-sm text-[#87938F] mt-1">Controle de receitas, sinais e comissões do estúdio</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleRefresh}
            title="Atualizar dados"
            className="flex items-center gap-2 h-10 px-3 rounded-[14px] border border-[#243337] bg-[#0B171C] hover:bg-[#102128] text-[#87938F] hover:text-[#F0EADD] text-sm transition-all"
          >
            <RefreshCw size={15} className={cn(isLoadingResumo || isLoadingLancamentos ? "animate-spin" : "")} />
          </button>
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 h-10 px-4 rounded-[14px] bg-[#2F9285] hover:bg-[#3AA99A] text-[#050B12] font-semibold text-sm transition-all"
          >
            <Plus size={16} />
            Novo Lançamento
          </button>
        </div>
      </div>

      {/* Banner de erro de conexão */}
      {isError && (
        <div className="flex items-center gap-3 p-4 mb-6 rounded-[14px] bg-[#E35D5B]/10 border border-[#E35D5B]/30 text-sm text-[#E35D5B]">
          <AlertCircle size={16} className="shrink-0" />
          <span>Falha ao carregar dados financeiros. Verifique sua conexão ou tente novamente.</span>
          <button
            onClick={handleRefresh}
            className="ml-auto text-xs font-semibold underline hover:no-underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div
              key={i}
              className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-5 flex items-center justify-between shadow-lg"
            >
              <div>
                <p className="text-[11px] text-[#87938F] uppercase tracking-wider mb-1 font-bold">{c.label}</p>
                <p className="text-2xl font-extrabold text-[#F0EADD]">
                  {isLoadingResumo ? (
                    <span className="inline-block w-24 h-6 bg-[#102128] animate-pulse rounded-md" />
                  ) : (
                    c.value
                  )}
                </p>
              </div>
              <div className="p-3 bg-[#102128] rounded-[12px] border border-[#243337]">
                <Icon size={20} className={c.color} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-[#0B171C] border border-[#243337] rounded-[14px] w-fit">
        <button
          onClick={() => setActiveTab("resumo")}
          className={cn(
            "px-4 py-2 rounded-[10px] text-sm font-medium transition-all",
            activeTab === "resumo"
              ? "bg-[#2F9285]/15 text-[#2F9285]"
              : "text-[#87938F] hover:text-[#F0EADD] hover:bg-[#102128]"
          )}
        >
          Resumo / Todos
        </button>
        <button
          onClick={() => setActiveTab("entradas")}
          className={cn(
            "px-4 py-2 rounded-[10px] text-sm font-medium transition-all",
            activeTab === "entradas"
              ? "bg-[#2F9285]/15 text-[#2F9285]"
              : "text-[#87938F] hover:text-[#F0EADD] hover:bg-[#102128]"
          )}
        >
          Entradas
        </button>
        <button
          onClick={() => setActiveTab("pendencias")}
          className={cn(
            "px-4 py-2 rounded-[10px] text-sm font-medium transition-all",
            activeTab === "pendencias"
              ? "bg-[#2F9285]/15 text-[#2F9285]"
              : "text-[#87938F] hover:text-[#F0EADD] hover:bg-[#102128]"
          )}
        >
          Pendências
        </button>
      </div>

      {/* Loading list */}
      {isLoadingLancamentos && (
        <div className="space-y-3 bg-[#0B171C] border border-[#243337] rounded-[18px] p-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-[#102128] rounded-[10px] animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoadingLancamentos && filteredLancamentos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-[#0B171C] border border-[#243337] rounded-[18px]">
          <Wallet size={40} className="text-[#243337] mb-3" />
          <p className="text-sm text-[#87938F]">Nenhum lançamento registrado</p>
        </div>
      )}

      {/* Transactions Table */}
      {!isLoadingLancamentos && filteredLancamentos.length > 0 && (
        <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#243337] bg-[#102128]/50 text-[11px] font-bold uppercase tracking-wider text-[#87938F]">
                  <th className="px-5 py-3">Data</th>
                  <th className="px-5 py-3">Descrição</th>
                  <th className="px-5 py-3">Tipo</th>
                  <th className="px-5 py-3">Método</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Valor</th>
                  <th className="px-5 py-3 text-right w-28">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#243337]/50 text-sm text-[#F0EADD]">
                {filteredLancamentos.map((item) => (
                  <tr key={item.id} className="hover:bg-[#102128]/35 transition-all">
                    <td className="px-5 py-3 text-[#87938F]">
                      {formatDate(item.data_realizada || item.data_prevista || item.data_prevista)}
                    </td>
                    <td className="px-5 py-3 font-medium">
                      {item.descricao || "Lançamento sem descrição"}
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn("font-semibold text-xs", TYPE_CONFIG[item.tipo]?.cls)}>
                        {TYPE_CONFIG[item.tipo]?.label || item.tipo}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-[#smoke-text]">
                      {item.forma_pagamento ? PAYMENT_LABELS[item.forma_pagamento] : "-"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border",
                          STATUS_COLORS[item.status]
                        )}
                      >
                        {STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-[#F0EADD]">
                      {item.tipo === "SAIDA" ? "- " : "+ "}
                      {formatCurrency(item.valor)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {item.status === "PENDENTE" && (
                          <button
                            onClick={() => updateLancamentoMutation.mutate({ id: item.id, status: "PAGO" })}
                            className="p-1.5 rounded-[8px] bg-[#2F9285]/10 border border-[#2F9285]/20 hover:bg-[#2F9285] hover:text-[#050B12] text-[#2F9285] transition-all"
                            title="Marcar como Pago"
                          >
                            <Check size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => handleEditClick(item)}
                          className="p-1.5 rounded-[8px] bg-[#5E9ED6]/10 border border-[#5E9ED6]/20 hover:bg-[#5E9ED6] hover:text-[#050B12] text-[#5E9ED6] transition-all"
                          title="Editar Lançamento"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Deseja realmente excluir este lançamento?")) {
                              deleteLancamentoMutation.mutate(item.id);
                            }
                          }}
                          className="p-1.5 rounded-[8px] bg-[#E35D5B]/10 border border-[#E35D5B]/20 hover:bg-[#E35D5B] hover:text-white text-[#E35D5B] transition-all"
                          title="Excluir Lançamento"
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
      )}

      {/* Modal Dialog for New Transaction */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0B171C] border border-[#243337] w-full max-w-md rounded-[18px] overflow-hidden shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#243337]">
              <div className="flex items-center gap-2">
                <Wallet size={18} className="text-[#2F9285]" />
                <h2 className="text-[#F0EADD] font-bold text-base">
                  {editingItem ? "Editar Lançamento" : "Novo Lançamento"}
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-[#87938F] hover:text-[#F0EADD]">
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {errorText && (
                <div className="p-3 bg-[#E35D5B]/10 border border-[#E35D5B]/20 text-[#E35D5B] text-xs rounded-lg flex items-center justify-between">
                  <span>{errorText}</span>
                  <button type="button" onClick={() => setErrorText(null)}><X size={14} /></button>
                </div>
              )}

              {/* Input: Tipo */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#87938F]">Tipo de Lançamento</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-[10px] bg-[#050B12] border border-[#243337] text-sm text-[#F0EADD] focus:border-[#2F9285]/60 outline-none transition-all"
                >
                  <option value="ENTRADA">Entrada (Serviço, Venda)</option>
                  <option value="SINAL">Sinal (Reserva de Agenda)</option>
                  <option value="SAIDA">Saída (Despesa, Material)</option>
                  <option value="COMISSAO">Comissão (Pagamento Artista)</option>
                </select>
              </div>

              {/* Input: Status */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#87938F]">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-[10px] bg-[#050B12] border border-[#243337] text-sm text-[#F0EADD] focus:border-[#2F9285]/60 outline-none transition-all"
                >
                  <option value="PAGO">Confirmado (Pago / Recebido)</option>
                  <option value="PENDENTE">Pendente (Agendado)</option>
                  {editingItem && (
                    <>
                      <option value="CANCELADO">Cancelado</option>
                      <option value="ESTORNADO">Estornado</option>
                    </>
                  )}
                </select>
              </div>

              {/* Input: Valor */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#87938F] flex items-center gap-1">
                  <DollarSign size={12} /> Valor (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Ex: 350.00"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  className="w-full h-10 px-3 rounded-[10px] bg-[#050B12] border border-[#243337] text-sm text-[#F0EADD] focus:border-[#2F9285]/60 outline-none transition-all"
                />
              </div>

              {/* Input: Descrição */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#87938F]">Descrição</label>
                <input
                  type="text"
                  placeholder="Ex: Sinal da Tatuagem de Leão - João"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full h-10 px-3 rounded-[10px] bg-[#050B12] border border-[#243337] text-sm text-[#F0EADD] focus:border-[#2F9285]/60 outline-none transition-all"
                />
              </div>

              {/* Input: Forma Pagamento */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#87938F] flex items-center gap-1">
                  <CreditCard size={12} /> Forma de Pagamento
                </label>
                <select
                  value={formaPagamento}
                  onChange={(e) => setFormaPagamento(e.target.value)}
                  className="w-full h-10 px-3 rounded-[10px] bg-[#050B12] border border-[#243337] text-sm text-[#F0EADD] focus:border-[#2F9285]/60 outline-none transition-all"
                >
                  <option value="PIX">Pix</option>
                  <option value="DINHEIRO">Dinheiro</option>
                  <option value="CARTAO_DEBITO">Cartão de Débito</option>
                  <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                  <option value="TRANSFERENCIA">Transferência Bancária</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </div>

              {/* Input: Data Prevista */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#87938F] flex items-center gap-1">
                  <Calendar size={12} /> Data do Lançamento
                </label>
                <input
                  type="date"
                  required
                  value={dataPrevista}
                  onChange={(e) => setDataPrevista(e.target.value)}
                  className="w-full h-10 px-3 rounded-[10px] bg-[#050B12] border border-[#243337] text-sm text-[#F0EADD] focus:border-[#2F9285]/60 outline-none transition-all"
                />
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 pt-4 border-t border-[#243337]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="flex-1 h-10 rounded-[12px] border border-[#243337] hover:bg-[#102128] text-[#F0EADD] font-semibold text-sm transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 h-10 rounded-[12px] bg-[#2F9285] hover:bg-[#3AA99A] disabled:opacity-60 text-[#050B12] font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  {isSaving && <Loader2 size={16} className="animate-spin" />}
                  {isSaving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

