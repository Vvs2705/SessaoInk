"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Plus, Search, UserCircle, Phone, Instagram } from "lucide-react";
import { api } from "@/lib/api/client";

interface Cliente {
  id: string;
  nome: string;
  telefone: string | null;
  instagram: string | null;
  email: string | null;
}

export default function ClientesPage() {
  const [busca, setBusca] = useState("");

  const { data = [], isLoading } = useQuery<Cliente[]>({
    queryKey: ["clientes"],
    queryFn: () => api.get("/api/v1/clientes/"),
  });

  const filtrado = data.filter(c =>
    !busca || [c.nome, c.telefone, c.instagram, c.email].some(v =>
      v?.toLowerCase().includes(busca.toLowerCase())
    )
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EADD]">Clientes</h1>
          <p className="text-sm text-[#87938F] mt-1">
            {isLoading ? "Carregando..." : `${data.length} cadastrado${data.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button className="flex items-center gap-2 h-10 px-4 rounded-[14px] bg-[#2F9285] hover:bg-[#3AA99A] text-[#050B12] font-semibold text-sm transition-all shrink-0">
          <Plus size={16} />
          Novo Cliente
        </button>
      </div>

      <div className="relative mb-6">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#87938F]" />
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome, telefone ou Instagram..."
          className="w-full h-10 pl-9 pr-4 rounded-[14px] bg-[#0B171C] border border-[#243337] text-[#F0EADD] text-sm placeholder-[#87938F] focus:outline-none focus:border-[#2F9285] transition-all"
        />
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-[#0B171C] border border-[#243337] rounded-[14px] animate-pulse" />)}
        </div>
      )}

      {!isLoading && filtrado.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-[#0B171C] border border-[#243337] rounded-[18px]">
          <UserCircle size={48} className="text-[#243337] mb-4" />
          <h3 className="text-[#F0EADD] font-semibold mb-2">
            {busca ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          </h3>
          <p className="text-sm text-[#87938F] max-w-xs mb-6">
            {busca ? "Tente outros termos." : "Clientes são criados quando alguém envia um orçamento, ou adicione manualmente."}
          </p>
          {!busca && (
            <button className="flex items-center gap-2 h-10 px-5 rounded-[14px] bg-[#2F9285] hover:bg-[#3AA99A] text-[#050B12] font-semibold text-sm">
              <Plus size={16} />
              Adicionar Cliente
            </button>
          )}
        </div>
      )}

      {!isLoading && filtrado.length > 0 && (
        <div className="space-y-2">
          {filtrado.map(c => (
            <div
              key={c.id}
              className="flex items-center justify-between p-4 bg-[#0B171C] border border-[#243337] rounded-[14px] hover:border-[#2F9285]/40 hover:bg-[#102128] transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#102128] border border-[#243337] flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-[#2F9285]">
                    {c.nome.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#F0EADD]">{c.nome}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {c.telefone && (
                      <span className="flex items-center gap-1 text-xs text-[#87938F]">
                        <Phone size={10} />{c.telefone}
                      </span>
                    )}
                    {c.instagram && (
                      <span className="flex items-center gap-1 text-xs text-[#87938F]">
                        <Instagram size={10} />{c.instagram}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <span className="text-xs text-[#2F9285]">Ver →</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
