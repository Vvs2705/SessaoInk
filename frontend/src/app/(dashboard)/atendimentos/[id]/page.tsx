"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, User, Phone, Instagram, ImageIcon, DollarSign, Calendar, FileText, Check, Loader2, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { CurrencyInput } from "@/components/ui/CurrencyInput";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

const STATUS_OPCIONAL_OPCOES = [
  { value: "SOLICITADO", label: "Solicitado" },
  { value: "EM_ANALISE", label: "Em Análise" },
  { value: "AGUARDANDO_SINAL", label: "Aguardando Sinal" },
  { value: "CONFIRMADO", label: "Confirmado" },
  { value: "EM_ATENDIMENTO", label: "Em Atendimento" },
  { value: "FINALIZADO", label: "Finalizado" },
  { value: "REAGENDADO", label: "Reagendado" },
  { value: "CANCELADO_CLIENTE", label: "Cancelado pelo Cliente" },
  { value: "CANCELADO_ESTUDIO", label: "Cancelado pelo Estúdio" },
  { value: "NAO_COMPARECEU", label: "Não Compareceu" },
  { value: "RETOQUE", label: "Retoque" },
];

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

function extrairContatoFallback(notas: string | null) {
  if (!notas) return null;
  const contatoMatch = notas.match(/Contato:\s*(.*?)(?=\s*\||$)/i);
  const whatsappMatch = notas.match(/WhatsApp:\s*(.*?)(?=\s*\||$)/i);
  const instagramMatch = notas.match(/Instagram:\s*(.*?)(?=\s*\||$)/i);

  if (!contatoMatch && !whatsappMatch) return null;

  return {
    nome: contatoMatch ? contatoMatch[1].trim() : "Cliente Temporário",
    whatsapp: whatsappMatch ? whatsappMatch[1].trim() : null,
    instagram: instagramMatch ? instagramMatch[1].trim() : null,
  };
}

export default function AtendimentoDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const queryClient = useQueryClient();

  const [statusOp, setStatusOp] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [valorSinal, setValorSinal] = useState("");
  const [notasPrivadas, setNotasPrivadas] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [imagemExpandida, setImagemExpandida] = useState<string | null>(null);

  // Queries
  const { data: atendimento, isLoading: loadAtendimento, isError } = useQuery<Atendimento>({
    queryKey: ["atendimento", id],
    queryFn: async () => {
      const data = await api.get<Atendimento>(`/api/v1/atendimentos/${id}`);
      setStatusOp(data.status_operacional);
      setValorTotal(data.valor_total?.toString() ?? "");
      setValorSinal(data.valor_sinal?.toString() ?? "");
      setNotasPrivadas(data.notas_privadas ?? "");
      return data;
    },
  });

  const { data: imagens = [], isLoading: carregandoImagens } = useQuery<string[]>({
    queryKey: ["atendimento-imagens", id],
    queryFn: () => api.get(`/api/v1/atendimentos/${id}/imagens`),
    enabled: !!atendimento,
  });

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.patch(`/api/v1/atendimentos/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["atendimento", id] });
      queryClient.invalidateQueries({ queryKey: ["atendimentos"] });
      setSucesso(true);
      setTimeout(() => setSucesso(false), 2000);
    },
    onError: (err: Error) => {
      setErro(err.message || "Erro ao salvar alterações.");
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    const payload: Record<string, unknown> = {
      status_operacional: statusOp,
      valor_total: valorTotal.trim() ? parseFloat(valorTotal) : null,
      valor_sinal: valorSinal.trim() ? parseFloat(valorSinal) : null,
      notas_privadas: notasPrivadas.trim() ? notasPrivadas : null,
    };
    mutation.mutate(payload);
  };

  const formatData = (iso: string | null) => {
    if (!iso) return "Não agendada";
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loadAtendimento) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6">
        <Loader2 size={32} className="text-teal-ink animate-spin mb-4" />
        <p className="text-sm text-text-subtle">Carregando atendimento...</p>
      </div>
    );
  }

  if (isError || !atendimento) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center py-20">
        <h2 className="text-xl font-bold text-porcelain-ink mb-2">Atendimento não encontrado</h2>
        <p className="text-sm text-text-subtle mb-6">O atendimento selecionado não existe ou pertence a outro estúdio.</p>
        <button
          onClick={() => router.push("/atendimentos")}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-[14px] bg-teal-ink text-ink-night font-semibold text-sm hover:bg-ink-gold transition-all"
        >
          <ArrowLeft size={16} /> Voltar para atendimentos
        </button>
      </div>
    );
  }

  const contato = atendimento.cliente
    ? {
        nome: atendimento.cliente.nome,
        whatsapp: atendimento.cliente.telefone,
        instagram: atendimento.cliente.instagram,
      }
    : extrairContatoFallback(atendimento.notas_privadas);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Voltar */}
      <button
        onClick={() => router.push("/atendimentos")}
        className="inline-flex items-center gap-1.5 text-sm text-text-subtle hover:text-porcelain-ink transition-colors mb-6"
      >
        <ArrowLeft size={14} /> Voltar para atendimentos
      </button>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-ink bg-teal-ink/10 px-2.5 py-1 rounded-full border border-teal-ink/20">
            {atendimento.tipo}
          </span>
          <h1 className="text-2xl font-bold text-porcelain-ink mt-2">Detalhes do Atendimento</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Lado Esquerdo: Dados e Contatos */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Dados do Pedido */}
          <div className="bg-ink-bg border border-mist-line rounded-[18px] p-5 space-y-4">
            <h3 className="text-xs font-bold text-text-subtle uppercase tracking-wider">Dados do Pedido</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-text-subtle block mb-0.5">Estilo</span>
                <span className="text-porcelain-ink font-medium">{atendimento.estilo || "—"}</span>
              </div>
              <div>
                <span className="text-xs text-text-subtle block mb-0.5">Parte do corpo</span>
                <span className="text-porcelain-ink font-medium">{atendimento.parte_corpo || "—"}</span>
              </div>
              <div>
                <span className="text-xs text-text-subtle block mb-0.5">Tamanho aproximado</span>
                <span className="text-porcelain-ink font-medium">{atendimento.tamanho_cm || "—"}</span>
              </div>
              <div>
                <span className="text-xs text-text-subtle block mb-0.5">Data da Sessão</span>
                <span className="text-porcelain-ink font-medium flex items-center gap-1.5">
                  <Calendar size={13} className="text-teal-ink" />
                  {formatData(atendimento.data_sessao)}
                </span>
              </div>
            </div>

            {atendimento.descricao && (
              <div className="border-t border-mist-line pt-4 mt-2">
                <span className="text-xs text-text-subtle block mb-1.5">Descrição detalhada</span>
                <p className="text-sm text-porcelain-ink leading-relaxed whitespace-pre-wrap bg-ink-night border border-mist-line/50 rounded-[12px] p-3">
                  {atendimento.descricao}
                </p>
              </div>
            )}
          </div>

          {/* Fotos de Referência */}
          <div className="bg-ink-bg border border-mist-line rounded-[18px] p-5 space-y-4">
            <h3 className="text-xs font-bold text-text-subtle uppercase tracking-wider flex items-center gap-1.5">
              <ImageIcon size={14} className="text-teal-ink" /> Fotos de Referência
            </h3>

            {carregandoImagens ? (
              <div className="flex items-center justify-center py-10 text-sm text-text-subtle gap-2">
                <Loader2 size={18} className="animate-spin text-teal-ink" /> Buscando referências...
              </div>
            ) : imagens.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {imagens.map((filename) => {
                  const imgUrl = `${API_URL}/api/v1/atendimentos/${id}/imagens/${filename}`;
                  return (
                    <button
                      key={filename}
                      type="button"
                      onClick={() => setImagemExpandida(imgUrl)}
                      className="aspect-square bg-ink-night border border-mist-line rounded-[12px] overflow-hidden hover:border-teal-ink/60 transition-colors group relative"
                    >
                      <img
                        src={imgUrl}
                        alt="Referência"
                        crossOrigin="use-credentials"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 border border-dashed border-mist-line rounded-[14px]">
                <p className="text-sm text-text-subtle">Nenhuma foto de referência anexada.</p>
              </div>
            )}
          </div>

        </div>

        {/* Lado Direito: Ações / Formulário e Contato */}
        <div className="md:col-span-1 space-y-6">
          
          {/* Informações do Cliente */}
          <div className="bg-ink-bg border border-mist-line rounded-[18px] p-5 space-y-4">
            <h3 className="text-xs font-bold text-text-subtle uppercase tracking-wider">Contato do Cliente</h3>
            {contato ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2.5 text-sm text-porcelain-ink">
                  <User size={15} className="text-text-subtle" />
                  <span className="font-semibold">{contato.nome}</span>
                </div>
                {contato.whatsapp && (
                  <div className="flex items-center gap-2.5 text-sm text-porcelain-ink">
                    <Phone size={15} className="text-text-subtle" />
                    <a
                      href={`https://wa.me/${contato.whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-teal-ink hover:underline"
                    >
                      {contato.whatsapp}
                    </a>
                  </div>
                )}
                {contato.instagram && (
                  <div className="flex items-center gap-2.5 text-sm text-porcelain-ink">
                    <Instagram size={15} className="text-text-subtle" />
                    <a
                      href={`https://instagram.com/${contato.instagram.replace("@", "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-teal-ink hover:underline"
                    >
                      {contato.instagram}
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-text-subtle italic">Sem informações de contato.</p>
            )}
          </div>

          {/* Editar Status & Valores */}
          <div className="bg-ink-bg border border-mist-line rounded-[18px] p-5">
            <form onSubmit={handleSave} className="space-y-4">
              <h3 className="text-xs font-bold text-text-subtle uppercase tracking-wider mb-2">Avaliação & Status</h3>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-text-subtle mb-1.5">Status Operacional</label>
                <select
                  value={statusOp}
                  onChange={(e) => setStatusOp(e.target.value)}
                  className="w-full h-10 px-3 rounded-[12px] bg-ink-night border border-mist-line text-porcelain-ink text-sm focus:border-teal-ink/60 outline-none transition-colors cursor-pointer"
                >
                  {STATUS_OPCIONAL_OPCOES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Valor Total */}
              <div>
                <label className="block text-xs font-medium text-text-subtle mb-1.5">Valor Total (R$)</label>
                <div className="relative">
                  <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
                  <CurrencyInput
                    value={valorTotal}
                    onValueChange={setValorTotal}
                    placeholder="0,00"
                    className="w-full h-10 pl-8 pr-3 rounded-[12px] bg-ink-night border border-mist-line text-porcelain-ink text-sm focus:border-teal-ink/60 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Valor Sinal */}
              <div>
                <label className="block text-xs font-medium text-text-subtle mb-1.5">Valor Sinal (R$)</label>
                <div className="relative">
                  <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
                  <CurrencyInput
                    value={valorSinal}
                    onValueChange={setValorSinal}
                    placeholder="0,00"
                    className="w-full h-10 pl-8 pr-3 rounded-[12px] bg-ink-night border border-mist-line text-porcelain-ink text-sm focus:border-teal-ink/60 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Notas Privadas */}
              <div>
                <label className="block text-xs font-medium text-text-subtle mb-1.5">Notas Privadas</label>
                <textarea
                  value={notasPrivadas}
                  onChange={(e) => setNotasPrivadas(e.target.value)}
                  placeholder="Observações internas..."
                  rows={4}
                  className="w-full px-3 py-2 rounded-[12px] bg-ink-night border border-mist-line text-porcelain-ink text-sm focus:border-teal-ink/60 outline-none transition-colors resize-none"
                />
              </div>

              {erro && (
                <div className="p-3 rounded-[10px] bg-error-red/10 border border-error-red/30 text-xs text-error-red">{erro}</div>
              )}

              <button
                type="submit"
                disabled={mutation.isPending || sucesso}
                className={cn(
                  "w-full h-10 rounded-[12px] text-sm font-semibold transition-all flex items-center justify-center gap-2",
                  sucesso
                    ? "bg-success text-ink-night"
                    : "bg-teal-ink hover:bg-ink-gold text-ink-night disabled:opacity-50"
                )}
              >
                {mutation.isPending ? (
                  <><Loader2 size={16} className="animate-spin" /> Salvando...</>
                ) : sucesso ? (
                  <><Check size={16} /> Salvo com sucesso!</>
                ) : (
                  "Salvar Alterações"
                )}
              </button>
            </form>
          </div>

        </div>

      </div>

      {/* Lightbox */}
      {imagemExpandida && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md cursor-zoom-out"
          onClick={() => setImagemExpandida(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-text-subtle hover:text-porcelain-ink border border-mist-line"
            onClick={() => setImagemExpandida(null)}
          >
            <X size={24} />
          </button>
          <img
            src={imagemExpandida}
            alt="Referência Ampliada"
            crossOrigin="use-credentials"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
        </div>
      )}
    </div>
  );
}
