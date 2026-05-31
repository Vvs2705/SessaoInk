"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, User, Phone, Instagram, Image as ImageIcon, DollarSign, Calendar, FileText, Check, Loader2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

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

interface DetalhesAtendimentoModalProps {
  atendimento: Atendimento;
  onClose: () => void;
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

export default function DetalhesAtendimentoModal({ atendimento, onClose }: DetalhesAtendimentoModalProps) {
  const queryClient = useQueryClient();
  const [statusOp, setStatusOp] = useState(atendimento.status_operacional);
  const [valorTotal, setValorTotal] = useState(atendimento.valor_total?.toString() ?? "");
  const [valorSinal, setValorSinal] = useState(atendimento.valor_sinal?.toString() ?? "");
  const [notasPrivadas, setNotasPrivadas] = useState(atendimento.notas_privadas ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [imagemExpandida, setImagemExpandida] = useState<string | null>(null);

  // Buscar as imagens do atendimento
  const { data: imagens = [], isLoading: carregandoImagens } = useQuery<string[]>({
    queryKey: ["atendimento-imagens", atendimento.id],
    queryFn: () => api.get(`/api/v1/atendimentos/${atendimento.id}/imagens`),
  });

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.patch(`/api/v1/atendimentos/${atendimento.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["atendimentos"] });
      setSucesso(true);
      setTimeout(() => {
        setSucesso(false);
        onClose();
      }, 1500);
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

  // Contato do cliente
  const contato = atendimento.cliente
    ? {
        nome: atendimento.cliente.nome,
        whatsapp: atendimento.cliente.telefone,
        instagram: atendimento.cliente.instagram,
      }
    : extrairContatoFallback(atendimento.notas_privadas);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#0B171C] border border-[#243337] rounded-[18px] shadow-2xl my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#243337]">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#2F9285] bg-[#2F9285]/10 px-2.5 py-1 rounded-full border border-[#2F9285]/20">
              {atendimento.tipo}
            </span>
            <h2 className="text-lg font-bold text-[#F0EADD] mt-2">Detalhes do Atendimento</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-[10px] text-[#87938F] hover:text-[#F0EADD] hover:bg-[#102128] transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[75vh] overflow-y-auto">
          
          {/* Lado Esquerdo: Detalhes do Atendimento & Contato */}
          <div className="space-y-6">
            
            {/* Informações da Tattoo */}
            <div className="bg-[#050B12] border border-[#243337] rounded-[14px] p-4 space-y-3">
              <h3 className="text-xs font-bold text-[#87938F] uppercase tracking-wider">Dados do Pedido</h3>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-xs text-[#87938F] block">Estilo</span>
                  <span className="text-[#F0EADD] font-medium">{atendimento.estilo || "—"}</span>
                </div>
                <div>
                  <span className="text-xs text-[#87938F] block">Parte do corpo</span>
                  <span className="text-[#F0EADD] font-medium">{atendimento.parte_corpo || "—"}</span>
                </div>
                <div className="mt-2">
                  <span className="text-xs text-[#87938F] block">Tamanho aproximado</span>
                  <span className="text-[#F0EADD] font-medium">{atendimento.tamanho_cm || "—"}</span>
                </div>
                <div className="mt-2">
                  <span className="text-xs text-[#87938F] block">Data da Sessão</span>
                  <span className="text-[#F0EADD] font-medium flex items-center gap-1">
                    <Calendar size={12} className="text-[#2F9285]" />
                    {formatData(atendimento.data_sessao)}
                  </span>
                </div>
              </div>

              {atendimento.descricao && (
                <div className="border-t border-[#243337] pt-2.5 mt-2">
                  <span className="text-xs text-[#87938F] block mb-1">Descrição detalhada</span>
                  <p className="text-sm text-[#F0EADD] leading-relaxed whitespace-pre-wrap">
                    {atendimento.descricao}
                  </p>
                </div>
              )}
            </div>

            {/* Informações do Cliente */}
            <div className="bg-[#050B12] border border-[#243337] rounded-[14px] p-4 space-y-3">
              <h3 className="text-xs font-bold text-[#87938F] uppercase tracking-wider">Informações de Contato</h3>
              
              {contato ? (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5 text-sm text-[#F0EADD]">
                    <User size={15} className="text-[#87938F]" />
                    <span className="font-semibold">{contato.nome}</span>
                  </div>
                  {contato.whatsapp && (
                    <div className="flex items-center gap-2.5 text-sm text-[#F0EADD]">
                      <Phone size={15} className="text-[#87938F]" />
                      <a
                        href={`https://wa.me/${contato.whatsapp.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#2F9285] hover:underline"
                      >
                        {contato.whatsapp}
                      </a>
                    </div>
                  )}
                  {contato.instagram && (
                    <div className="flex items-center gap-2.5 text-sm text-[#F0EADD]">
                      <Instagram size={15} className="text-[#87938F]" />
                      <a
                        href={`https://instagram.com/${contato.instagram.replace("@", "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#2F9285] hover:underline"
                      >
                        {contato.instagram}
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-[#87938F] italic">Sem informações de contato.</p>
              )}
            </div>

            {/* Galeria de Fotos de Referência */}
            <div className="bg-[#050B12] border border-[#243337] rounded-[14px] p-4 space-y-3">
              <h3 className="text-xs font-bold text-[#87938F] uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon size={14} className="text-[#2F9285]" />
                Fotos de Referência
              </h3>

              {carregandoImagens ? (
                <div className="flex items-center justify-center py-6 text-sm text-[#87938F] gap-2">
                  <Loader2 size={16} className="animate-spin text-[#2F9285]" />
                  Buscando referências...
                </div>
              ) : imagens.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {imagens.map((filename) => {
                    const imgUrl = `${API_URL}/api/v1/atendimentos/${atendimento.id}/imagens/${filename}`;
                    return (
                      <button
                        key={filename}
                        type="button"
                        onClick={() => setImagemExpandida(imgUrl)}
                        className="aspect-square bg-[#0B171C] border border-[#243337] rounded-[8px] overflow-hidden hover:border-[#2F9285]/60 transition-colors group relative"
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
                <p className="text-xs text-[#87938F] italic">Nenhuma foto de referência anexada.</p>
              )}
            </div>

          </div>

          {/* Lado Direito: Ações de Avaliação / Edição */}
          <form onSubmit={handleSave} className="space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-[#87938F] uppercase tracking-wider">Avaliação & Status</h3>

              {/* Status Operacional */}
              <div>
                <label className="block text-xs font-medium text-[#87938F] mb-1.5">
                  Status Operacional
                </label>
                <select
                  value={statusOp}
                  onChange={(e) => setStatusOp(e.target.value)}
                  className="w-full h-10 px-3 rounded-[12px] bg-[#050B12] border border-[#243337] text-[#F0EADD] text-sm focus:border-[#2F9285]/60 outline-none transition-colors cursor-pointer"
                >
                  {STATUS_OPCIONAL_OPCOES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Valores */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#87938F] mb-1.5">
                    Valor Total (R$)
                  </label>
                  <div className="relative">
                    <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#87938F]" />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={valorTotal}
                      onChange={(e) => setValorTotal(e.target.value)}
                      placeholder="0,00"
                      className="w-full h-10 pl-8 pr-3 rounded-[12px] bg-[#050B12] border border-[#243337] text-[#F0EADD] text-sm placeholder-[#87938F] focus:border-[#2F9285]/60 outline-none transition-colors"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-[#87938F] mb-1.5">
                    Valor Sinal (R$)
                  </label>
                  <div className="relative">
                    <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#87938F]" />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={valorSinal}
                      onChange={(e) => setValorSinal(e.target.value)}
                      placeholder="0,00"
                      className="w-full h-10 pl-8 pr-3 rounded-[12px] bg-[#050B12] border border-[#243337] text-[#F0EADD] text-sm placeholder-[#87938F] focus:border-[#2F9285]/60 outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Notas Privadas */}
              <div>
                <label className="block text-xs font-medium text-[#87938F] mb-1.5">
                  Notas Privadas
                </label>
                <textarea
                  value={notasPrivadas}
                  onChange={(e) => setNotasPrivadas(e.target.value)}
                  placeholder="Escreva observações internas sobre este atendimento..."
                  rows={5}
                  className="w-full px-3 py-2.5 rounded-[12px] bg-[#050B12] border border-[#243337] text-[#F0EADD] text-sm placeholder-[#87938F] focus:border-[#2F9285]/60 outline-none transition-colors resize-none"
                />
              </div>

              {/* Feedback de erro */}
              {erro && (
                <div className="p-3 rounded-[10px] bg-[#E35D5B]/10 border border-[#E35D5B]/30 text-sm text-[#E35D5B]">
                  {erro}
                </div>
              )}
            </div>

            {/* Footer de Ações */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-[#243337] mt-6">
              <button
                type="button"
                onClick={onClose}
                disabled={mutation.isPending}
                className="h-10 px-4 rounded-[12px] text-sm text-[#87938F] hover:text-[#F0EADD] hover:bg-[#102128] border border-[#243337] transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              
              <button
                type="submit"
                disabled={mutation.isPending || sucesso}
                className={cn(
                  "h-10 px-5 rounded-[12px] text-sm font-semibold transition-all flex items-center gap-2",
                  sucesso
                    ? "bg-[#54B88D] text-[#050B12]"
                    : "bg-[#2F9285] hover:bg-[#3AA99A] text-[#050B12] disabled:opacity-50"
                )}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Salvando...
                  </>
                ) : sucesso ? (
                  <>
                    <Check size={16} />
                    Salvo com sucesso!
                  </>
                ) : (
                  "Salvar Alterações"
                )}
              </button>
            </div>
          </form>

        </div>
      </div>

      {/* Lightbox para imagem expandida */}
      {imagemExpandida && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-zoom-out"
          onClick={() => setImagemExpandida(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 p-2.5 rounded-full bg-black/40 text-[#87938F] hover:text-[#F0EADD] border border-[#243337] transition-colors"
            onClick={() => setImagemExpandida(null)}
          >
            <X size={24} />
          </button>
          
          <img
            src={imagemExpandida}
            alt="Referência Ampliada"
            crossOrigin="use-credentials"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
