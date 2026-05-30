"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Plus, Search } from "lucide-react";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

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

interface Atendimento {
  id: string;
  tipo: string;
  estilo: string | null;
  parte_corpo: string | null;
  status_operacional: string;
  status_financeiro: string;
  valor_total: number | null;
  data_sessao: string | null;
}

export default function AtendimentosPage() {
  const [view, setView] = useState<"lista" | "kanban">("lista");
  const [busca, setBusca] = useState("");

  const { data = [], isLoading } = useQuery<Atendimento[]>({
    queryKey: ["atendimentos"],
    queryFn: () => api.get("/api/v1/atendimentos/"),
  });

  const filtrado = data.filter(a =>
    !busca || [a.tipo, a.estilo, a.parte_corpo].some(v =>
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
        <button className="flex items-center gap-2 h-10 px-4 rounded-[14px] bg-[#2F9285] hover:bg-[#3AA99A] text-[#050B12] font-semibold text-sm transition-all shrink-0">
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
              className={cn("h-10 px-4 rounded-[14px] text-sm font-medium border transition-all capitalize",
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
          {[1,2,3].map(i => (
            <div key={i} className="h-20 bg-[#0B171C] border border-[#243337] rounded-[14px] animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && filtrado.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-[#0B171C] border border-[#243337] rounded-[18px]">
          <ClipboardList size={48} className="text-[#243337] mb-4" />
          <h3 className="text-[#F0EADD] font-semibold mb-2">
            {busca ? "Nenhum resultado encontrado" : "Nenhum atendimento ainda"}
          </h3>
          <p className="text-sm text-[#87938F] max-w-xs mb-6">
            {busca ? "Tente outros termos de busca." : "Aguarde solicitações do portal público ou crie manualmente."}
          </p>
          {!busca && (
            <button className="flex items-center gap-2 h-10 px-5 rounded-[14px] bg-[#2F9285] hover:bg-[#3AA99A] text-[#050B12] font-semibold text-sm">
              <Plus size={16} />
              Criar Atendimento
            </button>
          )}
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
                      R$ {Number(a.valor_total).toFixed(2).replace(".", ",")}
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

      {/* Kanban placeholder */}
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
                      <div key={a.id} className="p-3 bg-[#0B171C] border border-[#243337] rounded-[14px] hover:border-[#2F9285]/40 transition-all cursor-pointer">
                        <p className="text-sm font-medium text-[#F0EADD]">{a.tipo}</p>
                        {a.estilo && <p className="text-xs text-[#87938F] mt-0.5">{a.estilo}</p>}
                        {a.valor_total && (
                          <p className="text-xs font-bold text-[#2F9285] mt-1">
                            R$ {Number(a.valor_total).toFixed(2).replace(".", ",")}
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
    </div>
  );
}
