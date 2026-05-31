"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, User, Phone, Instagram, Mail, Calendar, FileText, Plus, Edit2, Loader2, ClipboardList } from "lucide-react";
import { api } from "@/lib/api/client";
import { cn, formatCurrency } from "@/lib/utils";
import Link from "next/link";
import DetalhesAtendimentoModal from "../../atendimentos/DetalhesAtendimentoModal";

interface Cliente {
  id: string;
  nome: string;
  telefone: string | null;
  instagram: string | null;
  email: string | null;
  data_nascimento: string | null;
  notas: string | null;
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
  cliente: {
    id: string;
    nome: string;
    telefone: string | null;
    instagram: string | null;
    email: string | null;
  } | null;
}

export default function ClienteDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const [atendimentoSelecionado, setAtendimentoSelecionado] = useState<Atendimento | null>(null);

  // Queries
  const { data: cliente, isLoading: loadCliente, isError } = useQuery<Cliente>({
    queryKey: ["cliente", id],
    queryFn: () => api.get(`/api/v1/clientes/${id}`),
  });

  const { data: atendimentos = [], isLoading: loadAtendimentos } = useQuery<Atendimento[]>({
    queryKey: ["atendimentos"],
    queryFn: () => api.get("/api/v1/atendimentos/"),
  });

  const historico = atendimentos.filter((a) => a.cliente?.id === id);

  const formatData = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  };

  const getIniciais = (nome: string) => {
    return nome
      .split(" ")
      .map((n) => n.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  if (loadCliente) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6">
        <Loader2 size={32} className="text-[#2F9285] animate-spin mb-4" />
        <p className="text-sm text-[#87938F]">Carregando perfil do cliente...</p>
      </div>
    );
  }

  if (isError || !cliente) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center py-20">
        <h2 className="text-xl font-bold text-[#F0EADD] mb-2">Cliente não encontrado</h2>
        <p className="text-sm text-[#87938F] mb-6">O cliente selecionado não existe ou pertence a outro estúdio.</p>
        <button
          onClick={() => router.push("/clientes")}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-[14px] bg-[#2F9285] text-[#050B12] font-semibold text-sm hover:bg-[#3AA99A] transition-all"
        >
          <ArrowLeft size={16} /> Voltar para clientes
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Voltar */}
      <button
        onClick={() => router.push("/clientes")}
        className="inline-flex items-center gap-1.5 text-sm text-[#87938F] hover:text-[#F0EADD] transition-colors mb-6"
      >
        <ArrowLeft size={14} /> Voltar para clientes
      </button>

      {/* Grid principal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card do Perfil */}
        <div className="md:col-span-1 bg-[#0B171C] border border-[#243337] rounded-[18px] p-5 flex flex-col items-center text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-[#2F9285]/10 border border-[#2F9285]/20 flex items-center justify-center">
            <span className="text-2xl font-bold text-[#2F9285]">
              {getIniciais(cliente.nome)}
            </span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#F0EADD]">{cliente.nome}</h2>
            <p className="text-xs text-[#87938F] mt-1">Cliente do Estúdio</p>
          </div>

          <div className="w-full border-t border-[#243337] pt-4 space-y-3 text-left">
            {cliente.telefone && (
              <div className="flex items-center gap-3 text-sm text-[#F0EADD]">
                <Phone size={14} className="text-[#87938F] shrink-0" />
                <a
                  href={`https://wa.me/${cliente.telefone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#2F9285] hover:underline truncate"
                >
                  {cliente.telefone}
                </a>
              </div>
            )}
            {cliente.instagram && (
              <div className="flex items-center gap-3 text-sm text-[#F0EADD]">
                <Instagram size={14} className="text-[#87938F] shrink-0" />
                <a
                  href={`https://instagram.com/${cliente.instagram.replace("@", "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#2F9285] hover:underline truncate"
                >
                  {cliente.instagram}
                </a>
              </div>
            )}
            {cliente.email && (
              <div className="flex items-center gap-3 text-sm text-[#F0EADD]">
                <Mail size={14} className="text-[#87938F] shrink-0" />
                <span className="truncate">{cliente.email}</span>
              </div>
            )}
            {cliente.data_nascimento && (
              <div className="flex items-center gap-3 text-sm text-[#F0EADD]">
                <Calendar size={14} className="text-[#87938F] shrink-0" />
                <span>Nascimento: {formatData(cliente.data_nascimento)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Histórico & Notas */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Bloco de Notas */}
          <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-5 space-y-3">
            <h3 className="text-sm font-bold text-[#F0EADD] flex items-center gap-2">
              <FileText size={16} className="text-[#2F9285]" /> Notas do Cliente
            </h3>
            <p className="text-sm text-[#87938F] whitespace-pre-wrap leading-relaxed">
              {cliente.notas || "Nenhuma observação interna registrada para este cliente."}
            </p>
          </div>

          {/* Histórico de Atendimentos */}
          <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F0EADD] flex items-center gap-2">
                <ClipboardList size={16} className="text-[#2F9285]" /> Histórico de Atendimentos
              </h3>
              <Link
                href={`/atendimentos?cliente_id=${cliente.id}`}
                className="inline-flex items-center gap-1.5 text-xs text-[#2F9285] hover:underline"
              >
                <Plus size={12} /> Novo Atendimento
              </Link>
            </div>

            {loadAtendimentos ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-14 bg-[#102128] rounded-[12px] animate-pulse" />
                ))}
              </div>
            ) : historico.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-[#243337] rounded-[14px]">
                <p className="text-sm text-[#87938F]">Nenhum atendimento registrado para este cliente.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {historico.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => setAtendimentoSelecionado(a)}
                    className="flex items-center justify-between p-3.5 bg-[#050B12] border border-[#243337] rounded-[12px] hover:border-[#2F9285]/40 hover:bg-[#102128] transition-all cursor-pointer"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#F0EADD]">{a.tipo}</p>
                      <p className="text-xs text-[#87938F] mt-0.5">
                        {a.parte_corpo || "Corpo"} • {a.estilo || "Estilo livre"}
                      </p>
                    </div>
                    <div className="text-right">
                      {a.valor_total && (
                        <p className="text-sm font-bold text-[#F0EADD]">{formatCurrency(a.valor_total)}</p>
                      )}
                      <p className="text-[10px] text-[#87938F] mt-0.5">{formatData(a.data_sessao)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Modal Detalhes Atendimento */}
      {atendimentoSelecionado && (
        <DetalhesAtendimentoModal
          atendimento={atendimentoSelecionado}
          onClose={() => setAtendimentoSelecionado(null)}
        />
      )}
    </div>
  );
}
