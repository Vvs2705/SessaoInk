"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, ClipboardList, Users, Wallet, TrendingUp, AlertCircle, Copy, ExternalLink } from "lucide-react";
import { api } from "@/lib/api/client";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";
import DetalhesAtendimentoModal from "./atendimentos/DetalhesAtendimentoModal";

function StatCard({ label, value, icon: Icon, color, loading }: {
  label: string; value: string; icon: React.ElementType; color: string; loading?: boolean;
}) {
  return (
    <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-5 flex items-center justify-between shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
      <div>
        <p className="text-[11px] text-[#87938F] font-medium uppercase tracking-wider mb-1">{label}</p>
        {loading ? (
          <div className="h-9 w-16 bg-[#102128] animate-pulse rounded" />
        ) : (
          <p className="text-3xl font-extrabold text-[#F0EADD]">{value}</p>
        )}
      </div>
      <div className="p-3 bg-[#102128] rounded-[10px] border border-[#243337]">
        <Icon size={22} className={color} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [atendimentoSelecionado, setAtendimentoSelecionado] = useState<any | null>(null);
  const [copiado, setCopiado] = useState(false);

  const { data: atendimentos, isLoading: loadAt } = useQuery({
    queryKey: ["atendimentos"],
    queryFn: () => api.get<any[]>("/api/v1/atendimentos/"),
  });

  const { data: clientes, isLoading: loadCli } = useQuery({
    queryKey: ["clientes"],
    queryFn: () => api.get<any[]>("/api/v1/clientes/"),
  });

  const { data: resumo, isLoading: loadFin } = useQuery({
    queryKey: ["financeiro-resumo"],
    queryFn: () => api.get<any>("/api/v1/financeiro/resumo"),
    refetchOnMount: true,
  });

  const { data: estudio } = useQuery({
    queryKey: ["estudio"],
    queryFn: () => api.get<any>("/api/v1/estudio/"),
    staleTime: 1000 * 60 * 5,
  });

  const portalUrl = estudio?.slug ? `https://sessao-ink.vercel.app/${estudio.slug}` : null;

  const handleCopiarPortal = () => {
    if (!portalUrl) return;
    navigator.clipboard.writeText(portalUrl);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const ativos = atendimentos?.filter(a =>
    !["FINALIZADO","CANCELADO_CLIENTE","CANCELADO_ESTUDIO"].includes(a.status_operacional)
  ).length ?? 0;

  const hoje = new Date();
  const sessoesHoje = atendimentos?.filter(a => {
    if (!a.data_sessao) return false;
    const d = new Date(a.data_sessao);
    return d.toDateString() === hoje.toDateString();
  }).length ?? 0;

  const pendentes = atendimentos?.filter(a =>
    ["SOLICITADO","EM_ANALISE","AGUARDANDO_SINAL"].includes(a.status_operacional)
  ) ?? [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#F0EADD]">Início</h1>
        <p className="text-sm text-[#87938F] mt-1">Visão geral do seu estúdio</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard label="Atendimentos Ativos" value={String(ativos)} icon={ClipboardList} color="text-[#2F9285]" loading={loadAt} />
        <StatCard label="Sessões Hoje" value={String(sessoesHoje)} icon={Calendar} color="text-[#C36B3F]" loading={loadAt} />
        <StatCard label="Clientes Cadastrados" value={String(clientes?.length ?? 0)} icon={Users} color="text-[#5E9ED6]" loading={loadCli} />
        <StatCard label="Receita do Mês" value={formatCurrency(resumo?.receita_mes ?? 0)} icon={Wallet} color="text-[#54B88D]" loading={loadFin} />
      </div>

      {/* Card do Portal — destaque */}
      <div className="mb-8 bg-[#0B171C] border border-[#2F9285]/30 rounded-[18px] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_0_30px_rgba(47,146,133,0.07)]">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-[#2F9285]/10 rounded-[12px] border border-[#2F9285]/20 shrink-0">
            <ExternalLink size={20} className="text-[#2F9285]" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#F0EADD]">Portal do cliente</p>
            <p className="text-xs text-[#87938F] mt-0.5">Compartilhe este link — clientes pedem orçamento sem precisar de login</p>
            {portalUrl ? (
              <p className="text-xs font-mono text-[#2F9285] mt-1 truncate max-w-xs">{portalUrl}</p>
            ) : (
              <div className="h-3 w-40 bg-[#102128] animate-pulse rounded mt-1" />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopiarPortal}
            disabled={!portalUrl}
            className="flex items-center gap-2 h-9 px-4 rounded-[12px] bg-[#2F9285] hover:bg-[#3AA99A] disabled:opacity-40 text-[#050B12] font-semibold text-xs transition-all"
          >
            <Copy size={13} />
            {copiado ? "Copiado!" : "Copiar link"}
          </button>
          {portalUrl && (
            <a
              href={portalUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 h-9 px-3 rounded-[12px] border border-[#243337] bg-[#0B171C] hover:bg-[#102128] text-[#87938F] hover:text-[#F0EADD] text-xs transition-all"
            >
              <ExternalLink size={13} />
              Ver
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sessões hoje */}
        <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[#F0EADD] text-sm">Sessões Hoje</h2>
            <Link href="/agenda" className="text-xs text-[#2F9285] hover:underline">Ver agenda</Link>
          </div>
          {loadAt ? (
            <div className="space-y-2">
              {[1,2].map(i => <div key={i} className="h-12 bg-[#102128] animate-pulse rounded-[10px]" />)}
            </div>
          ) : sessoesHoje === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Calendar size={36} className="text-[#243337] mb-3" />
              <p className="text-sm text-[#87938F]">Nenhuma sessão para hoje</p>
              <Link href="/atendimentos" className="mt-3 text-xs text-[#2F9285] hover:underline">
                Criar atendimento
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {atendimentos?.filter(a => {
                const d = new Date(a.data_sessao);
                return d.toDateString() === hoje.toDateString();
              }).map((a: any) => (
                <div key={a.id} className="p-3 bg-[#102128] rounded-[10px] border border-[#243337]">
                  <p className="text-sm text-[#F0EADD] font-medium">{a.tipo}</p>
                  <p className="text-xs text-[#87938F]">{new Date(a.data_sessao).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pendências */}
        <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={16} className="text-[#D99A3D]" />
            <h2 className="font-semibold text-[#F0EADD] text-sm">Orçamentos Pendentes</h2>
            {pendentes.length > 0 && (
              <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-[#D99A3D]/20 text-[#D99A3D]">
                {pendentes.length}
              </span>
            )}
          </div>
          {loadAt ? (
            <div className="space-y-2">
              {[1,2].map(i => <div key={i} className="h-12 bg-[#102128] animate-pulse rounded-[10px]" />)}
            </div>
          ) : pendentes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <TrendingUp size={36} className="text-[#243337] mb-3" />
              <p className="text-sm text-[#87938F]">Nenhuma pendência</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendentes.slice(0, 5).map((a: any) => (
                <button
                  key={a.id}
                  onClick={() => setAtendimentoSelecionado(a)}
                  className="w-full flex items-center justify-between p-3 bg-[#102128] rounded-[10px] border border-[#243337] hover:border-[#2F9285]/40 transition-all text-left"
                >
                  <div>
                    <p className="text-sm text-[#F0EADD] font-medium">{a.tipo} • {a.estilo || "Sem estilo"}</p>
                    <p className="text-xs text-[#87938F]">{a.status_operacional.replace(/_/g, " ")}</p>
                  </div>
                  <span className="text-xs text-[#2F9285]">Ver →</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {atendimentoSelecionado && (
        <DetalhesAtendimentoModal
          atendimento={atendimentoSelecionado}
          onClose={() => setAtendimentoSelecionado(null)}
        />
      )}
    </div>
  );
}
