"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wallet,
  TrendingUp,
  Clock,
  Plus,
  Loader2,
  X,
  Calendar,
  DollarSign,
  CreditCard,
  Check,
  Trash2,
  Edit2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  FileSpreadsheet,
  TrendingDown,
  User,
  Percent,
  Layers,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { cn, formatCurrency } from "@/lib/utils";
import { CurrencyInput } from "@/components/ui/CurrencyInput";

interface LancamentoItem {
  id: string;
  tipo: "ENTRADA" | "SAIDA" | "COMISSAO" | "SINAL" | "RESERVA" | "ESTORNO" | "AJUSTE";
  descricao: string | null;
  valor: number;
  status: "PENDENTE" | "PAGO" | "PARCIAL" | "CANCELADO" | "ESTORNADO";
  forma_pagamento: "PIX" | "DINHEIRO" | "CARTAO_DEBITO" | "CARTAO_CREDITO" | "TRANSFERENCIA" | "OUTRO" | null;
  data_prevista: string | null;
  data_realizada: string | null;
  categoria: string | null;
  centro_custo: string | null;
  origem: string;
  valor_bruto: number | null;
  valor_taxa: number | null;
  valor_liquido: number | null;
  competencia: string | null;
  data_vencimento: string | null;
  comissao_percentual: number | null;
  lancamento_origem_id: string | null;
  recorrencia: string;
  parcela_numero: number | null;
  parcela_total: number | null;
  grupo_id: string | null;
  criado_por_id: string | null;
  cancelado_por_id: string | null;
  cancelado_em: string | null;
  motivo_cancelamento: string | null;
  artista_id: string | null;
  atendimento_id: string | null;
}

interface EquipeMembro {
  id: string;
  nome: string;
  email: string;
  tipo: string;
}

interface AtendimentoItem {
  id: string;
  tipo: string;
  cliente: { nome: string } | null;
  valor_total: number | null;
  status_operacional: string;
}

interface ConsolidadoResponse {
  resumo: {
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
  };
  graficos: {
    por_categoria: Array<{ categoria: string; valor: number }>;
    por_artista: Array<{ artista_nome: string; valor: number }>;
    fluxo_diario: Array<{ dia: string; entradas: number; saidas: number }>;
  };
}

const PAYMENT_LABELS: Record<string, string> = {
  PIX: "Pix",
  DINHEIRO: "Dinheiro",
  CARTAO_DEBITO: "Débito",
  CARTAO_CREDITO: "Crédito",
  TRANSFERENCIA: "Transferência",
  OUTRO: "Outro",
};

const STATUS_LABELS: Record<string, string> = {
  PENDENTE: "Pendente",
  PAGO: "Pago",
  PARCIAL: "Parcial",
  CANCELADO: "Cancelado",
  ESTORNADO: "Estornado",
};

const STATUS_COLORS: Record<string, string> = {
  PENDENTE: "text-warning bg-warning/10 border-warning/20",
  PAGO: "text-success bg-success/10 border-success/20",
  PARCIAL: "text-info bg-info/10 border-info/20",
  CANCELADO: "text-error-red bg-error-red/10 border-error-red/20",
  ESTORNADO: "text-error-red bg-error-red/10 border-error-red/20",
};

const TYPE_CONFIG: Record<string, { label: string; cls: string }> = {
  ENTRADA: { label: "Entrada", cls: "text-success" },
  SAIDA: { label: "Saída", cls: "text-error-red" },
  COMISSAO: { label: "Comissão", cls: "text-[#A78BFA]" },
  SINAL: { label: "Sinal", cls: "text-info" },
  RESERVA: { label: "Reserva", cls: "text-info" }, // Blue color for agenda/reserva status constraint
  ESTORNO: { label: "Estorno", cls: "text-error-red" },
  AJUSTE: { label: "Ajuste", cls: "text-text-subtle" },
};

const CATEGORIES = [
  "SERVICO_TATUAGEM",
  "SINAL_RESERVA",
  "VENDA_PRODUTO",
  "MATERIAL",
  "ALUGUEL",
  "MARKETING",
  "TAXA_CARTAO",
  "COMISSAO_ARTISTA",
  "MANUTENCAO",
  "SOFTWARE",
  "OUTROS",
];

const COST_CENTERS = [
  "ESTUDIO",
  "ARTISTA",
  "ATENDIMENTO",
  "ESTOQUE",
  "MARKETING",
  "ADMINISTRATIVO",
];

function Toast({
  tipo,
  mensagem,
  onClose,
}: {
  tipo: "sucesso" | "erro";
  mensagem: string;
  onClose: () => void;
}) {
  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-[14px] border shadow-xl z-50 animate-in slide-in-from-bottom-4",
        tipo === "sucesso"
          ? "bg-ink-bg border-teal-ink/40 text-teal-ink"
          : "bg-ink-bg border-error-red/40 text-error-red"
      )}
    >
      {tipo === "sucesso" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
      <span className="text-sm font-medium text-porcelain-ink">{mensagem}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  );
}

export default function FinanceiroPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"visao-geral" | "entradas" | "saidas" | "comissoes" | "reservas" | "consolidado">("visao-geral");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isComissaoModalOpen, setIsComissaoModalOpen] = useState(false);
  const [toast, setToast] = useState<{ tipo: "sucesso" | "erro"; mensagem: string } | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  // Filters state
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroArtista, setFiltroArtista] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const showToast = (tipo: "sucesso" | "erro", mensagem: string) => {
    setToast({ tipo, mensagem });
    setTimeout(() => setToast(null), 4000);
  };

  // Dynamic date bounds for consolidated view
  const defaultInicio = new Date();
  defaultInicio.setDate(1); // 1st of month
  const defaultFim = new Date(defaultInicio.getFullYear(), defaultInicio.getMonth() + 1, 0); // last day

  const [consolidadoInicio, setConsolidadoInicio] = useState(defaultInicio.toISOString().split("T")[0]);
  const [consolidadoFim, setConsolidadoFim] = useState(defaultFim.toISOString().split("T")[0]);

  // Queries
  const { data: usuario, isLoading: isLoadingUsuario } = useQuery<{ tipo: string }>({
    queryKey: ["auth-me"],
    queryFn: () => api.get("/api/v1/auth/me"),
  });
  const isAdmin = usuario?.tipo === "ADMIN";

  // Aba efetiva: um não-admin nunca deve enxergar "consolidado". Derivamos o
  // valor em vez de chamar setActiveTab no corpo do componente (que disparava
  // setState durante o render e causava re-render em cascata / aviso do React).
  const effectiveTab = !isAdmin && activeTab === "consolidado" ? "visao-geral" : activeTab;

  const { data: equipe = [] } = useQuery<EquipeMembro[]>({
    queryKey: ["estudio-equipe"],
    queryFn: () => api.get("/api/v1/estudio/equipe"),
    enabled: isAdmin,
  });

  const { data: atendimentos = [] } = useQuery<AtendimentoItem[]>({
    queryKey: ["atendimentos"],
    queryFn: () => api.get("/api/v1/atendimentos/"),
    enabled: isAdmin,
  });

  const {
    data: lancamentos = [],
    isLoading: isLoadingLancamentos,
    refetch: refetchLancamentos,
  } = useQuery<LancamentoItem[]>({
    queryKey: ["financeiro-lancamentos", effectiveTab, filtroCategoria, filtroArtista, dataInicio, dataFim],
    queryFn: () => {
      let url = "/api/v1/financeiro/";
      if (effectiveTab === "entradas") url = "/api/v1/financeiro/entradas";
      else if (effectiveTab === "saidas") url = "/api/v1/financeiro/saidas";
      else if (effectiveTab === "comissoes") url = "/api/v1/financeiro/comissoes";
      else if (effectiveTab === "reservas") url = "/api/v1/financeiro/reservas";

      const params = new URLSearchParams();
      if (effectiveTab === "visao-geral") {
        if (filtroCategoria) params.append("categoria", filtroCategoria);
        if (filtroArtista) params.append("artista_id", filtroArtista);
        if (dataInicio) params.append("data_inicio", dataInicio);
        if (dataFim) params.append("data_fim", dataFim);
      }
      return api.get(url + (params.toString() ? `?${params.toString()}` : ""));
    },
    refetchOnMount: true,
  });

  const {
    data: consolidado,
    isLoading: isLoadingConsolidado,
    refetch: refetchConsolidado,
  } = useQuery<ConsolidadoResponse>({
    queryKey: ["financeiro-consolidado", consolidadoInicio, consolidadoFim],
    queryFn: () => api.get(`/api/v1/financeiro/consolidado?inicio=${consolidadoInicio}&fim=${consolidadoFim}`),
    enabled: effectiveTab === "consolidado",
  });

  // Mutations
  const addLancamentoMutation = useMutation({
    mutationFn: (dados: any) => api.post("/api/v1/financeiro/", dados),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro-lancamentos"] });
      qc.invalidateQueries({ queryKey: ["financeiro-consolidado"] });
      setIsModalOpen(false);
      showToast("sucesso", "Lançamento adicionado com sucesso!");
    },
    onError: (err: any) => showToast("erro", err.message ?? "Erro ao salvar lançamento."),
  });

  const updateLancamentoMutation = useMutation({
    mutationFn: ({ id, ...dados }: { id: string; [key: string]: any }) =>
      api.patch(`/api/v1/financeiro/${id}`, dados),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro-lancamentos"] });
      qc.invalidateQueries({ queryKey: ["financeiro-consolidado"] });
      setIsModalOpen(false);
      showToast("sucesso", "Lançamento atualizado com sucesso!");
    },
    onError: (err: any) => showToast("erro", err.message ?? "Erro ao atualizar lançamento."),
  });

  const deleteLancamentoMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/financeiro/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro-lancamentos"] });
      qc.invalidateQueries({ queryKey: ["financeiro-consolidado"] });
      showToast("sucesso", "Lançamento deletado!");
    },
    onError: (err: any) => showToast("erro", err.message ?? "Erro ao deletar lançamento."),
  });

  const gerarComissaoMutation = useMutation({
    mutationFn: (dados: any) => api.post("/api/v1/financeiro/comissoes/gerar", dados),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro-lancamentos"] });
      qc.invalidateQueries({ queryKey: ["financeiro-consolidado"] });
      setIsComissaoModalOpen(false);
      showToast("sucesso", "Comissão gerada com sucesso!");
    },
    onError: (err: any) => showToast("erro", err.message ?? "Erro ao gerar comissão."),
  });

  const pagarComissaoMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/financeiro/comissoes/${id}/pagar`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro-lancamentos"] });
      qc.invalidateQueries({ queryKey: ["financeiro-consolidado"] });
      showToast("sucesso", "Comissão paga com sucesso!");
    },
    onError: (err: any) => showToast("erro", err.message ?? "Erro ao pagar comissão."),
  });

  // Modal form states
  const [editingItem, setEditingItem] = useState<LancamentoItem | null>(null);
  const [tipo, setTipo] = useState<any>("ENTRADA");
  const [status, setStatus] = useState<any>("PAGO");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [dataPrevista, setDataPrevista] = useState("");
  const [categoria, setCategoria] = useState("");
  const [centroCusto, setCentroCusto] = useState("");
  const [valorTaxa, setValorTaxa] = useState("");
  const [artistaId, setArtistaId] = useState("");
  const [atendimentoId, setAtendimentoId] = useState("");
  const [recorrencia, setRecorrencia] = useState("NENHUMA");
  const [parcelaNumero, setParcelaNumero] = useState("");
  const [parcelaTotal, setParcelaTotal] = useState("");
  const [motivoCancelamento, setMotivoCancelamento] = useState("");

  // Commission Form States
  const [comArtistId, setComArtistId] = useState("");
  const [comAtendId, setComAtendId] = useState("");
  const [comValor, setComValor] = useState("");
  const [comPercent, setComPercent] = useState("");
  const [comDesc, setComDesc] = useState("");

  const handleOpenModal = () => {
    setEditingItem(null);
    setTipo("ENTRADA");
    setStatus("PAGO");
    setDescricao("");
    setValor("");
    setFormaPagamento("PIX");
    setDataPrevista(new Date().toISOString().split("T")[0]);
    setCategoria("SERVICO_TATUAGEM");
    setCentroCusto("ESTUDIO");
    setValorTaxa("");
    setArtistaId("");
    setAtendimentoId("");
    setRecorrencia("NENHUMA");
    setParcelaNumero("");
    setParcelaTotal("");
    setMotivoCancelamento("");
    setIsModalOpen(true);
  };

  const handleEditClick = (item: LancamentoItem) => {
    setEditingItem(item);
    setTipo(item.tipo);
    setStatus(item.status);
    setDescricao(item.descricao || "");
    setValor(String(item.valor));
    setFormaPagamento(item.forma_pagamento || "PIX");
    setDataPrevista(item.data_prevista ? new Date(item.data_prevista).toISOString().split("T")[0] : "");
    setCategoria(item.categoria || "");
    setCentroCusto(item.centro_custo || "");
    setValorTaxa(item.valor_taxa ? String(item.valor_taxa) : "");
    setArtistaId(item.artista_id || "");
    setAtendimentoId(item.atendimento_id || "");
    setRecorrencia(item.recorrencia);
    setParcelaNumero(item.parcela_numero ? String(item.parcela_numero) : "");
    setParcelaTotal(item.parcela_total ? String(item.parcela_total) : "");
    setMotivoCancelamento(item.motivo_cancelamento || "");
    setIsModalOpen(true);
  };

  const handleOpenComissaoModal = () => {
    setComArtistId("");
    setComAtendId("");
    setComValor("");
    setComPercent("40"); // Default 40%
    setComDesc("");
    setIsComissaoModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const valNum = parseFloat(valor);
    if (isNaN(valNum) || valNum <= 0) {
      showToast("erro", "O valor deve ser maior que zero.");
      return;
    }

    const payload = {
      tipo,
      status,
      descricao: descricao.trim() || undefined,
      valor: valNum,
      forma_pagamento: formaPagamento || undefined,
      data_prevista: dataPrevista ? new Date(dataPrevista).toISOString() : undefined,
      categoria: categoria || undefined,
      centro_custo: centroCusto || undefined,
      valor_taxa: valorTaxa ? parseFloat(valorTaxa) : undefined,
      artista_id: artistaId || undefined,
      atendimento_id: atendimentoId || undefined,
      recorrencia: recorrencia || undefined,
      parcela_numero: parcelaNumero ? parseInt(parcelaNumero) : undefined,
      parcela_total: parcelaTotal ? parseInt(parcelaTotal) : undefined,
      motivo_cancelamento: status === "CANCELADO" && motivoCancelamento.trim() ? motivoCancelamento.trim() : undefined,
    };

    if (editingItem) {
      updateLancamentoMutation.mutate({ id: editingItem.id, ...payload });
    } else {
      addLancamentoMutation.mutate(payload);
    }
  };

  if (isLoadingUsuario) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-surface-raised rounded mb-2" />
        <div className="h-4 w-72 bg-surface-raised rounded mb-6" />
        <div className="h-12 bg-ink-bg border border-mist-line rounded-[18px]" />
      </div>
    );
  }

  if (usuario?.tipo === "ARTISTA") {
    return (
      <div className="p-6 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle size={48} className="text-error-red mb-4 animate-bounce" />
        <h1 className="text-xl font-extrabold text-porcelain-ink">Acesso Restrito</h1>
        <p className="text-xs text-text-subtle mt-2 max-w-md">
          Como Artista, você não possui permissão para visualizar o painel financeiro ou realizar lançamentos. Entre em contato com o administrador.
        </p>
      </div>
    );
  }

  const handleComissaoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comArtistId || !comAtendId || !comValor || !comPercent) {
      showToast("erro", "Preencha todos os campos obrigatórios.");
      return;
    }
    gerarComissaoMutation.mutate({
      artista_id: comArtistId,
      atendimento_id: comAtendId,
      valor_servico: parseFloat(comValor),
      comissao_percentual: parseFloat(comPercent),
      descricao: comDesc.trim() || undefined,
    });
  };

  const handleExportCSV = () => {
    const url = "/api/v1/financeiro/exportar";
    const params = new URLSearchParams();
    if (busca) params.append("busca", busca);
    if (filtroCategoria) params.append("categoria", filtroCategoria);
    if (filtroArtista) params.append("artista_id", filtroArtista);
    if (dataInicio) params.append("data_inicio", dataInicio);
    if (dataFim) params.append("data_fim", dataFim);

    if (effectiveTab === "entradas") {
      params.append("tipo", "ENTRADA");
    } else if (effectiveTab === "saidas") {
      params.append("tipo", "SAIDA");
    } else if (effectiveTab === "comissoes") {
      params.append("tipo", "COMISSAO");
    } else if (effectiveTab === "reservas") {
      params.append("tipo", "SINAL");
    }
    window.open(url + (params.toString() ? `?${params.toString()}` : ""), "_blank");
  };

  const handleRefresh = () => {
    if (effectiveTab === "consolidado") refetchConsolidado();
    else refetchLancamentos();
  };

  const filteredLancamentos = lancamentos.filter((l) => {
    if (!busca) return true;
    return (
      l.descricao?.toLowerCase().includes(busca.toLowerCase()) ||
      l.categoria?.toLowerCase().includes(busca.toLowerCase()) ||
      l.centro_custo?.toLowerCase().includes(busca.toLowerCase())
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-porcelain-ink tracking-tight">Financeiro</h1>
          <p className="text-sm text-text-subtle">Classificação contábil, pagamentos de artistas e relatórios de fluxo de caixa</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRefresh}
            title="Atualizar dados"
            className="flex items-center justify-center w-10 h-10 rounded-[14px] border border-mist-line bg-ink-bg hover:bg-surface-raised text-text-subtle hover:text-porcelain-ink transition-all"
          >
            <RefreshCw size={16} className={cn(isLoadingLancamentos || isLoadingConsolidado ? "animate-spin" : "")} />
          </button>
          {isAdmin && (
            <>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 h-10 px-4 rounded-[14px] border border-mist-line bg-ink-bg hover:bg-surface-raised text-porcelain-ink text-sm font-semibold transition-all"
              >
                <FileSpreadsheet size={15} />
                Exportar CSV
              </button>
              <button
                onClick={handleOpenComissaoModal}
                className="flex items-center gap-2 h-10 px-4 rounded-[14px] border border-teal-ink/20 bg-teal-ink/10 hover:bg-teal-ink/20 text-teal-ink text-sm font-semibold transition-all"
              >
                <Percent size={15} />
                Gerar Comissão
              </button>
              <button
                onClick={handleOpenModal}
                className="flex items-center gap-2 h-10 px-4 rounded-[14px] bg-teal-ink hover:bg-ink-gold text-ink-night font-semibold text-sm transition-all"
              >
                <Plus size={16} />
                Novo Lançamento
              </button>
            </>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 p-1 bg-ink-bg border border-mist-line rounded-[16px] overflow-x-auto w-full md:w-fit">
        {[
          { id: "visao-geral", label: "Visão Geral" },
          { id: "entradas", label: "Entradas" },
          { id: "saidas", label: "Saídas" },
          { id: "comissoes", label: "Comissões" },
          { id: "reservas", label: "Sinais / Reservas" },
          ...(isAdmin ? [{ id: "consolidado", label: "Consolidado" }] : []),
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={cn(
              "px-4 py-2.5 rounded-[12px] text-xs font-semibold whitespace-nowrap transition-all duration-300",
              effectiveTab === t.id
                ? "bg-teal-ink/15 text-teal-ink shadow-sm"
                : "text-text-subtle hover:text-porcelain-ink hover:bg-surface-raised"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Contents: Consolidado View */}
      {effectiveTab === "consolidado" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Period Selection */}
          <div className="flex items-center gap-3 p-4 bg-ink-bg border border-mist-line rounded-[18px] w-fit flex-wrap">
            <span className="text-xs font-bold text-text-subtle uppercase tracking-wider">Período Consolidado:</span>
            <input
              type="date"
              value={consolidadoInicio}
              onChange={(e) => setConsolidadoInicio(e.target.value)}
              className="bg-ink-night border border-mist-line rounded-[10px] px-3 py-1.5 text-xs text-porcelain-ink focus:border-teal-ink outline-none"
            />
            <span className="text-xs text-text-subtle">até</span>
            <input
              type="date"
              value={consolidadoFim}
              onChange={(e) => setConsolidadoFim(e.target.value)}
              className="bg-ink-night border border-mist-line rounded-[10px] px-3 py-1.5 text-xs text-porcelain-ink focus:border-teal-ink outline-none"
            />
          </div>

          {/* Analytical summary cards */}
          {isLoadingConsolidado ? (
            <div className="space-y-6 animate-pulse">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-28 bg-ink-bg border border-mist-line rounded-[18px]" />
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-64 bg-ink-bg border border-mist-line rounded-[18px]" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="h-64 bg-ink-bg border border-mist-line rounded-[18px]" />
                  <div className="h-64 bg-ink-bg border border-mist-line rounded-[18px]" />
                </div>
              </div>
            </div>
          ) : (
            consolidado && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-ink-bg border border-mist-line rounded-[18px] p-5 shadow-lg flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-text-subtle font-bold uppercase tracking-wider">Receitas (Pagas)</span>
                    <h3 className="text-2xl font-extrabold text-success mt-1">{formatCurrency(consolidado.resumo.entradas_pagas)}</h3>
                    <p className="text-[10px] text-text-subtle mt-1">Previsto: {formatCurrency(consolidado.resumo.entradas_pagas + consolidado.resumo.entradas_pendentes)}</p>
                  </div>
                  <div className="p-3 bg-success/10 rounded-[12px] border border-success/20">
                    <TrendingUp size={20} className="text-success" />
                  </div>
                </div>

                <div className="bg-ink-bg border border-mist-line rounded-[18px] p-5 shadow-lg flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-text-subtle font-bold uppercase tracking-wider">Despesas (Pagas)</span>
                    <h3 className="text-2xl font-extrabold text-error-red mt-1">{formatCurrency(consolidado.resumo.saidas_pagas)}</h3>
                    <p className="text-[10px] text-text-subtle mt-1">A pagar: {formatCurrency(consolidado.resumo.saidas_pendentes)}</p>
                  </div>
                  <div className="p-3 bg-error-red/10 rounded-[12px] border border-error-red/20">
                    <TrendingDown size={20} className="text-error-red" />
                  </div>
                </div>

                <div className="bg-ink-bg border border-mist-line rounded-[18px] p-5 shadow-lg flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-text-subtle font-bold uppercase tracking-wider">Saldo Líquido</span>
                    <h3 className={cn("text-2xl font-extrabold mt-1", consolidado.resumo.saldo_realizado >= 0 ? "text-success" : "text-error-red")}>
                      {formatCurrency(consolidado.resumo.saldo_realizado)}
                    </h3>
                    <p className="text-[10px] text-text-subtle mt-1">Estimado: {formatCurrency(consolidado.resumo.saldo_previsto)}</p>
                  </div>
                  <div className="p-3 bg-surface-raised rounded-[12px] border border-mist-line">
                    <Wallet size={20} className="text-porcelain-ink" />
                  </div>
                </div>

                <div className="bg-ink-bg border border-mist-line rounded-[18px] p-5 shadow-lg flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-text-subtle font-bold uppercase tracking-wider">Comissões Pendentes</span>
                    <h3 className="text-2xl font-extrabold text-warning mt-1">{formatCurrency(consolidado.resumo.comissoes_pendentes)}</h3>
                    <p className="text-[10px] text-text-subtle mt-1">Pagas: {formatCurrency(consolidado.resumo.comissoes_pagas)}</p>
                  </div>
                  <div className="p-3 bg-warning/10 rounded-[12px] border border-warning/20">
                    <Clock size={20} className="text-warning" />
                  </div>
                </div>
              </div>
            )
          )}

          {/* Consolidated charts block */}
          {consolidado && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily Flow Chart (SVG) */}
              <div className="bg-ink-bg border border-mist-line rounded-[18px] p-5 space-y-4 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-porcelain-ink">Fluxo diário (Entradas vs Saídas)</h3>
                    <p className="text-xs text-text-subtle">Apenas lançamentos confirmados/pagos</p>
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
                </div>
                {consolidado.graficos.fluxo_diario.length === 0 ? (
                  <div className="h-48 flex items-center justify-center border border-dashed border-mist-line rounded-[12px] text-xs text-text-subtle">Sem dados para exibir no período</div>
                ) : (
                  <div
                    className="relative pt-4"
                    role="img"
                    aria-label={`Gráfico de fluxo diário: ${consolidado.graficos.fluxo_diario.length} dia(s) com entradas e saídas pagas no período.`}
                  >
                    <div className="flex justify-between items-end gap-1.5 h-48">
                      {consolidado.graficos.fluxo_diario.map((d, idx) => {
                        const maxVal = Math.max(...consolidado.graficos.fluxo_diario.map(fd => Math.max(fd.entradas, fd.saidas)), 1);
                        const entPct = (d.entradas / maxVal) * 100;
                        const saiPct = (d.saidas / maxVal) * 100;
                        const diaLabel = new Date(d.dia + "T00:00:00").toLocaleDateString("pt-BR");
                        return (
                          <div
                            key={idx}
                            className="flex-1 flex flex-col items-center group relative h-full justify-end"
                            role="img"
                            aria-label={`${diaLabel}: entradas ${formatCurrency(d.entradas)}, saídas ${formatCurrency(d.saidas)}`}
                          >
                            <div className="w-full flex gap-0.5 justify-center items-end h-full" aria-hidden="true">
                              <div style={{ height: `${entPct}%` }} className="w-2.5 bg-success rounded-t-[3px] hover:bg-[#68cca0] transition-all" title={`Entrada: ${formatCurrency(d.entradas)}`} />
                              <div style={{ height: `${saiPct}%` }} className="w-2.5 bg-error-red rounded-t-[3px] hover:bg-[#c94d4b] transition-all" title={`Saída: ${formatCurrency(d.saidas)}`} />
                            </div>
                            <span className="text-[9px] text-text-subtle font-semibold mt-2.5 transform -rotate-45 origin-top-left translate-y-1 block whitespace-nowrap" aria-hidden="true">{d.dia.split("-")[2]}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Artist and Category Charts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Revenue by Artist */}
                <div className="bg-ink-bg border border-mist-line rounded-[18px] p-5 space-y-4 shadow-lg flex flex-col">
                  <div>
                    <h3 className="text-sm font-bold text-porcelain-ink">Receita por Artista</h3>
                    <p className="text-xs text-text-subtle">Faturamento no período</p>
                  </div>
                  <div className="flex-1 flex flex-col justify-center space-y-3">
                    {consolidado.graficos.por_artista.length === 0 ? (
                      <p className="text-xs text-text-subtle text-center my-10">Sem lançamentos no período</p>
                    ) : (
                      consolidado.graficos.por_artista.map((art, idx) => {
                        const total = consolidado.resumo.entradas_pagas || 1;
                        const pct = (art.valor / total) * 100;
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between text-xs font-semibold text-porcelain-ink">
                              <span>{art.artista_nome}</span>
                              <span>{formatCurrency(art.valor)}</span>
                            </div>
                            <div className="w-full bg-ink-night h-2 rounded-full overflow-hidden border border-mist-line" aria-hidden="true">
                              <div style={{ width: `${pct}%` }} className="bg-teal-ink h-full rounded-full" />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Expenses by Category */}
                <div className="bg-ink-bg border border-mist-line rounded-[18px] p-5 space-y-4 shadow-lg flex flex-col">
                  <div>
                    <h3 className="text-sm font-bold text-porcelain-ink">Despesas por Categoria</h3>
                    <p className="text-xs text-text-subtle">Classificação de saídas</p>
                  </div>
                  <div className="flex-1 flex flex-col justify-center space-y-3">
                    {consolidado.graficos.por_categoria.length === 0 ? (
                      <p className="text-xs text-text-subtle text-center my-10">Sem despesas registradas</p>
                    ) : (
                      consolidado.graficos.por_categoria.map((cat, idx) => {
                        const total = consolidado.resumo.saidas_pagas || 1;
                        const pct = (cat.valor / total) * 100;
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between text-xs font-semibold text-porcelain-ink">
                              <span className="capitalize">{cat.categoria.toLowerCase().replace("_", " ")}</span>
                              <span>{formatCurrency(cat.valor)}</span>
                            </div>
                            <div className="w-full bg-ink-night h-2 rounded-full overflow-hidden border border-mist-line" aria-hidden="true">
                              <div style={{ width: `${pct}%` }} className="bg-error-red h-full rounded-full" />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Contents: Visão Geral / List Tabs */}
      {effectiveTab !== "consolidado" && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Buscar por descrição, categoria..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full h-10 pl-4 pr-10 rounded-[14px] bg-ink-bg border border-mist-line text-porcelain-ink text-sm placeholder-text-subtle focus:outline-none focus:border-teal-ink transition-all"
              />
            </div>

            {effectiveTab === "visao-geral" && (
              <div className="flex gap-2 flex-wrap items-center">
                <select
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                  className="h-10 px-3 rounded-[14px] bg-ink-bg border border-mist-line text-xs text-porcelain-ink outline-none"
                >
                  <option value="">Todas Categorias</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.replace("_", " ")}
                    </option>
                  ))}
                </select>

                {isAdmin && (
                  <select
                    value={filtroArtista}
                    onChange={(e) => setFiltroArtista(e.target.value)}
                    className="h-10 px-3 rounded-[14px] bg-ink-bg border border-mist-line text-xs text-porcelain-ink outline-none"
                  >
                    <option value="">Todos Artistas</option>
                    {equipe.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                )}

                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="h-10 px-3 rounded-[14px] bg-ink-bg border border-mist-line text-xs text-porcelain-ink outline-none"
                  title="Data Início"
                />
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="h-10 px-3 rounded-[14px] bg-ink-bg border border-mist-line text-xs text-porcelain-ink outline-none"
                  title="Data Fim"
                />
              </div>
            )}
          </div>

          {/* List Loader */}
          {isLoadingLancamentos && (
            <div className="bg-ink-bg border border-mist-line rounded-[18px] overflow-hidden shadow-xl p-5 space-y-3 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-mist-line/30 last:border-b-0">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="h-4 w-20 bg-surface-raised rounded" />
                    <div className="h-4 w-40 bg-surface-raised rounded" />
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="h-4 w-16 bg-surface-raised rounded" />
                    <div className="h-5 w-16 bg-surface-raised rounded-full" />
                    <div className="h-4 w-20 bg-surface-raised rounded text-right" />
                    <div className="h-8 w-24 bg-surface-raised rounded-[8px]" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoadingLancamentos && filteredLancamentos.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-ink-bg border border-mist-line rounded-[18px]">
              <Wallet size={48} className="text-mist-line mb-4" />
              <h3 className="text-porcelain-ink font-bold text-sm">Nenhum lançamento financeiro</h3>
              <p className="text-xs text-text-subtle mt-1">Cadastre transações ou ajuste seus filtros</p>
            </div>
          )}

          {/* Desktop Table & Mobile Cards */}
          {!isLoadingLancamentos && filteredLancamentos.length > 0 && (
            <div className="bg-ink-bg border border-mist-line rounded-[18px] overflow-hidden shadow-xl">
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-mist-line bg-surface-raised/50 text-[10px] font-bold uppercase tracking-wider text-text-subtle">
                      <th className="px-5 py-4">Competência / Data</th>
                      <th className="px-5 py-4">Descrição</th>
                      <th className="px-5 py-4">Tipo</th>
                      <th className="px-5 py-4">Categoria</th>
                      <th className="px-5 py-4">Forma</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4 text-right">Líquido / Total</th>
                      <th className="px-5 py-4 text-right w-36">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mist-line/30 text-sm text-porcelain-ink">
                    {filteredLancamentos.map((item) => (
                      <tr key={item.id} className="hover:bg-surface-raised/20 transition-all">
                        <td className="px-5 py-3.5 text-xs text-text-subtle">
                          {item.competencia
                            ? new Date(item.competencia + "T00:00:00").toLocaleDateString("pt-BR")
                            : item.data_realizada
                            ? new Date(item.data_realizada).toLocaleDateString("pt-BR")
                            : "—"}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-xs">
                          <div>{item.descricao || "Sem descrição"}</div>
                          {item.recorrencia !== "NENHUMA" && (
                            <span className="text-[10px] text-teal-ink font-semibold uppercase bg-teal-ink/10 px-1.5 py-0.5 rounded-[4px] mt-1 inline-block">
                              {item.recorrencia} {item.parcela_numero && `(${item.parcela_numero}/${item.parcela_total})`}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={cn("font-bold text-xs uppercase", TYPE_CONFIG[item.tipo]?.cls)}>
                            {TYPE_CONFIG[item.tipo]?.label || item.tipo}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs capitalize text-text-subtle">
                          {item.categoria ? item.categoria.toLowerCase().replace("_", " ") : "—"}
                        </td>
                        <td className="px-5 py-3.5 text-xs">
                          {item.forma_pagamento ? PAYMENT_LABELS[item.forma_pagamento] : "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border", STATUS_COLORS[item.status])}>
                            {STATUS_LABELS[item.status] || item.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="font-bold">
                            {item.tipo === "SAIDA" || item.tipo === "COMISSAO" ? "- " : "+ "}
                            {formatCurrency(item.valor_liquido !== null ? item.valor_liquido : item.valor)}
                          </div>
                          {item.valor_taxa && item.valor_taxa > 0 ? (
                            <div className="text-[9px] text-error-red">Taxa: {formatCurrency(item.valor_taxa)}</div>
                          ) : null}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            {item.status === "PENDENTE" && isAdmin && (
                              <button
                                onClick={() => updateLancamentoMutation.mutate({ id: item.id, status: "PAGO" })}
                                className="p-1.5 rounded-[8px] bg-teal-ink/10 border border-teal-ink/20 hover:bg-teal-ink hover:text-ink-night text-teal-ink transition-all"
                                title="Marcar como Pago"
                              >
                                <Check size={13} />
                              </button>
                            )}
                            {item.tipo === "COMISSAO" && item.status === "PENDENTE" && isAdmin && (
                              <button
                                onClick={() => pagarComissaoMutation.mutate(item.id)}
                                className="p-1.5 rounded-[8px] bg-[#A78BFA]/10 border border-[#A78BFA]/20 hover:bg-[#A78BFA] hover:text-ink-night text-[#A78BFA] transition-all"
                                title="Confirmar pagamento de comissão"
                              >
                                <Check size={13} />
                              </button>
                            )}
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => handleEditClick(item)}
                                  className="p-1.5 rounded-[8px] bg-info/10 border border-info/20 hover:bg-info hover:text-ink-night text-info transition-all"
                                  title="Editar"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() => setDeleteItemId(item.id)}
                                  className="p-1.5 rounded-[8px] bg-error-red/10 border border-error-red/20 hover:bg-error-red hover:text-white text-error-red transition-all"
                                  title="Excluir"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards (list view for smaller devices) */}
              <div className="block lg:hidden divide-y divide-mist-line/30">
                {filteredLancamentos.map((item) => (
                  <div key={item.id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-text-subtle">
                        {item.competencia
                          ? new Date(item.competencia + "T00:00:00").toLocaleDateString("pt-BR")
                          : item.data_realizada
                          ? new Date(item.data_realizada).toLocaleDateString("pt-BR")
                          : "—"}
                      </span>
                      <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border", STATUS_COLORS[item.status])}>
                        {STATUS_LABELS[item.status]}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-porcelain-ink">{item.descricao || "Sem descrição"}</h4>
                      {item.categoria && <p className="text-xs text-text-subtle capitalize mt-0.5">{item.categoria.toLowerCase().replace("_", " ")}</p>}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={cn("text-xs font-bold uppercase", TYPE_CONFIG[item.tipo]?.cls)}>
                        {TYPE_CONFIG[item.tipo]?.label || item.tipo}
                      </span>
                      <div className="text-right">
                        <span className="text-sm font-bold text-porcelain-ink">
                          {item.tipo === "SAIDA" || item.tipo === "COMISSAO" ? "- " : "+ "}
                          {formatCurrency(item.valor_liquido !== null ? item.valor_liquido : item.valor)}
                        </span>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex justify-end gap-2 pt-2 border-t border-mist-line/10">
                        {item.status === "PENDENTE" && (
                          <button
                            onClick={() => updateLancamentoMutation.mutate({ id: item.id, status: "PAGO" })}
                            className="h-8 px-3 rounded-[8px] bg-teal-ink/10 text-teal-ink text-xs font-semibold flex items-center gap-1"
                          >
                            <Check size={12} /> Pago
                          </button>
                        )}
                        <button onClick={() => handleEditClick(item)} className="p-1.5 rounded-[8px] border border-mist-line text-text-subtle">
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteItemId(item.id)}
                          className="p-1.5 rounded-[8px] border border-error-red/20 text-error-red"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal dialog for creating/editing launches */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-ink-bg border border-mist-line w-full max-w-lg rounded-[20px] overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-mist-line shrink-0">
              <h2 className="text-base font-bold text-porcelain-ink">{editingItem ? "Editar Lançamento" : "Novo Lançamento"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-text-subtle hover:text-porcelain-ink">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-subtle">Tipo de Lançamento *</label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as any)}
                    className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-mist-line text-sm text-porcelain-ink focus:border-teal-ink outline-none"
                  >
                    <option value="ENTRADA">Entrada (Serviço, Venda)</option>
                    <option value="SINAL">Sinal (Reserva de Agenda)</option>
                    <option value="RESERVA">Reserva de Sala</option>
                    <option value="SAIDA">Saída (Despesa, Material)</option>
                    <option value="COMISSAO">Comissão de Artista</option>
                    <option value="ESTORNO">Estorno</option>
                    <option value="AJUSTE">Ajuste Contábil</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-subtle">Status *</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-mist-line text-sm text-porcelain-ink focus:border-teal-ink outline-none"
                  >
                    <option value="PAGO">Pago / Liquidado</option>
                    <option value="PENDENTE">Pendente / Agendado</option>
                    <option value="PARCIAL">Pago Parcial</option>
                    <option value="CANCELADO">Cancelado</option>
                    <option value="ESTORNADO">Estornado</option>
                  </select>
                </div>
              </div>

              {status === "CANCELADO" && (
                <div className="space-y-1 animate-in slide-in-from-top-2">
                  <label className="text-xs font-semibold text-error-red">Motivo do Cancelamento *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Cancelamento de sessão solicitado pelo cliente"
                    value={motivoCancelamento}
                    onChange={(e) => setMotivoCancelamento(e.target.value)}
                    className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-error-red/30 text-sm text-porcelain-ink focus:border-error-red outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-subtle">Valor Bruto *</label>
                  <CurrencyInput
                    required
                    placeholder="0,00"
                    value={valor}
                    onValueChange={setValor}
                    className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-mist-line text-sm text-porcelain-ink focus:border-teal-ink outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-subtle">Taxa Gateway (R$)</label>
                  <CurrencyInput
                    placeholder="0,00"
                    value={valorTaxa}
                    onValueChange={setValorTaxa}
                    className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-mist-line text-sm text-porcelain-ink focus:border-teal-ink outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-subtle">Valor Líquido</label>
                  <div className="w-full h-10 px-3 rounded-[10px] bg-surface-raised border border-mist-line text-sm text-text-subtle flex items-center font-bold">
                    {formatCurrency(Math.max(0, (parseFloat(valor) || 0) - (parseFloat(valorTaxa) || 0)))}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-subtle">Descrição</label>
                <input
                  type="text"
                  placeholder="Ex: Sinal da Tattoo do João"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-mist-line text-sm text-porcelain-ink focus:border-teal-ink outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-subtle">Categoria</label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-mist-line text-sm text-porcelain-ink focus:border-teal-ink outline-none"
                  >
                    <option value="">Sem Categoria</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-subtle">Centro de Custo</label>
                  <select
                    value={centroCusto}
                    onChange={(e) => setCentroCusto(e.target.value)}
                    className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-mist-line text-sm text-porcelain-ink focus:border-teal-ink outline-none"
                  >
                    <option value="">Sem Centro de Custo</option>
                    {COST_CENTERS.map((cc) => (
                      <option key={cc} value={cc}>
                        {cc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-subtle">Forma de Pagamento</label>
                  <select
                    value={formaPagamento}
                    onChange={(e) => setFormaPagamento(e.target.value)}
                    className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-mist-line text-sm text-porcelain-ink focus:border-teal-ink outline-none"
                  >
                    <option value="PIX">Pix</option>
                    <option value="DINHEIRO">Dinheiro</option>
                    <option value="CARTAO_DEBITO">Cartão de Débito</option>
                    <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                    <option value="TRANSFERENCIA">Transferência Bancária</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-subtle">Competência / Vencimento</label>
                  <input
                    type="date"
                    required
                    value={dataPrevista}
                    onChange={(e) => setDataPrevista(e.target.value)}
                    className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-mist-line text-sm text-porcelain-ink focus:border-teal-ink outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-subtle">Artista</label>
                  <select
                    value={artistaId}
                    onChange={(e) => setArtistaId(e.target.value)}
                    className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-mist-line text-sm text-porcelain-ink focus:border-teal-ink outline-none"
                  >
                    <option value="">Nenhum</option>
                    {equipe.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-subtle">Recorrência</label>
                  <select
                    value={recorrencia}
                    onChange={(e) => setRecorrencia(e.target.value)}
                    className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-mist-line text-sm text-porcelain-ink focus:border-teal-ink outline-none"
                  >
                    <option value="NENHUMA">Nenhuma</option>
                    <option value="SEMANAL">Semanal</option>
                    <option value="MENSAL">Mensal</option>
                    <option value="ANUAL">Anual</option>
                  </select>
                </div>
              </div>

              {recorrencia !== "NENHUMA" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-teal-ink">Parcela Atual</label>
                    <input
                      type="number"
                      placeholder="1"
                      value={parcelaNumero}
                      onChange={(e) => setParcelaNumero(e.target.value)}
                      className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-teal-ink/30 text-sm text-porcelain-ink focus:border-teal-ink outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-teal-ink">Total de Parcelas</label>
                    <input
                      type="number"
                      placeholder="12"
                      value={parcelaTotal}
                      onChange={(e) => setParcelaTotal(e.target.value)}
                      className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-teal-ink/30 text-sm text-porcelain-ink focus:border-teal-ink outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-mist-line">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 h-10 rounded-[12px] border border-mist-line hover:bg-surface-raised text-porcelain-ink font-semibold text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={addLancamentoMutation.isPending || updateLancamentoMutation.isPending}
                  className="flex-1 h-10 rounded-[12px] bg-teal-ink hover:bg-ink-gold text-ink-night font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  {(addLancamentoMutation.isPending || updateLancamentoMutation.isPending) && <Loader2 size={14} className="animate-spin" />}
                  Salvar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal dialog for generating commissions */}
      {isComissaoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-ink-bg border border-mist-line w-full max-w-md rounded-[20px] overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-mist-line shrink-0">
              <div className="flex items-center gap-2 text-teal-ink">
                <Percent size={18} />
                <h2 className="text-base font-bold text-porcelain-ink">Gerar Comissão</h2>
              </div>
              <button onClick={() => setIsComissaoModalOpen(false)} className="text-text-subtle hover:text-porcelain-ink">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleComissaoSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-subtle">Artista Beneficiário *</label>
                <select
                  required
                  value={comArtistId}
                  onChange={(e) => setComArtistId(e.target.value)}
                  className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-mist-line text-sm text-porcelain-ink outline-none focus:border-teal-ink"
                >
                  <option value="">Selecione o artista...</option>
                  {equipe.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome} ({m.tipo})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-subtle">Atendimento Vinculado *</label>
                <select
                  required
                  value={comAtendId}
                  onChange={(e) => setComAtendId(e.target.value)}
                  className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-mist-line text-sm text-porcelain-ink outline-none focus:border-teal-ink"
                >
                  <option value="">Selecione o atendimento...</option>
                  {atendimentos.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.tipo} - {a.cliente?.nome || "Cliente avulso"} ({formatCurrency(a.valor_total || 0)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-subtle">Valor do Serviço *</label>
                  <CurrencyInput
                    required
                    placeholder="0,00"
                    value={comValor}
                    onValueChange={setComValor}
                    className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-mist-line text-sm text-porcelain-ink outline-none focus:border-teal-ink"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-subtle">Percentual Comissão *</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      required
                      placeholder="40"
                      value={comPercent}
                      onChange={(e) => setComPercent(e.target.value)}
                      className="w-full h-10 pl-3 pr-8 rounded-[10px] bg-ink-night border border-mist-line text-sm text-porcelain-ink outline-none focus:border-teal-ink"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-subtle">%</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-subtle">Descrição Opcional</label>
                <input
                  type="text"
                  placeholder="Ex: Comissão Tattoo João - Finalizado"
                  value={comDesc}
                  onChange={(e) => setComDesc(e.target.value)}
                  className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-mist-line text-sm text-porcelain-ink outline-none focus:border-teal-ink"
                />
              </div>

              <div className="bg-surface-raised/50 border border-mist-line p-3 rounded-[12px] flex items-center justify-between text-xs">
                <span className="text-text-subtle font-semibold">Valor da Comissão Calculado:</span>
                <span className="text-porcelain-ink font-bold text-sm">
                  {formatCurrency((parseFloat(comValor) || 0) * ((parseFloat(comPercent) || 0) / 100))}
                </span>
              </div>

              <div className="flex gap-3 pt-4 border-t border-mist-line">
                <button
                  type="button"
                  onClick={() => setIsComissaoModalOpen(false)}
                  className="flex-1 h-10 rounded-[12px] border border-mist-line hover:bg-surface-raised text-porcelain-ink font-semibold text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={gerarComissaoMutation.isPending}
                  className="flex-1 h-10 rounded-[12px] bg-teal-ink hover:bg-ink-gold text-ink-night font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  {gerarComissaoMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                  Gerar Comissão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {toast && <Toast tipo={toast.tipo} mensagem={toast.mensagem} onClose={() => setToast(null)} />}

      {/* Modal: Confirmar Exclusão */}
      {deleteItemId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-ink-bg border border-error-red/20 w-full max-w-sm rounded-[20px] overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-error-red">
              <AlertCircle size={24} />
              <h3 className="text-base font-bold text-porcelain-ink">Confirmar Exclusão</h3>
            </div>
            <p className="text-xs text-text-subtle">
              Tem certeza que deseja excluir permanentemente este lançamento financeiro? Esta ação não poderá ser desfeita.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteItemId(null)}
                className="flex-1 h-9 rounded-[10px] border border-mist-line hover:bg-surface-raised text-porcelain-ink text-xs font-semibold transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  deleteLancamentoMutation.mutate(deleteItemId);
                  setDeleteItemId(null);
                }}
                disabled={deleteLancamentoMutation.isPending}
                className="flex-1 h-9 rounded-[10px] bg-error-red hover:bg-[#c94d4b] text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
              >
                {deleteLancamentoMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
