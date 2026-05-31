"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Image as ImageIcon, ArrowLeft, Loader2, X, MessageCircle, AlertCircle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

interface PortfolioItem {
  id: string;
  titulo: string | null;
  descricao: string | null;
  estilo: string | null;
  parte_corpo: string | null;
  imagem_path: string;
}

export default function PortfolioPublicoPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  
  // Lightbox state
  const [activeItem, setActiveItem] = useState<PortfolioItem | null>(null);

  useEffect(() => {
    async function carregarPortfolio() {
      try {
        const res = await fetch(`${API_URL}/api/v1/public/${slug}/portfolio`);
        if (!res.ok) {
          throw new Error("Erro ao carregar portfólio.");
        }
        const data = await res.json();
        setPortfolio(data);
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro ao carregar portfólio.");
      } finally {
        setLoading(false);
      }
    }
    carregarPortfolio();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050B12] flex flex-col items-center justify-center p-6">
        <Loader2 size={32} className="text-[#2F9285] animate-spin mb-4" />
        <p className="text-sm text-[#87938F]">Carregando portfólio...</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="min-h-screen bg-[#050B12] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-[#0B171C] border border-[#243337] mx-auto mb-5 flex items-center justify-center">
            <AlertCircle size={28} className="text-[#E35D5B]" />
          </div>
          <h1 className="text-xl font-bold text-[#F0EADD] mb-2">Erro ao carregar portfólio</h1>
          <p className="text-sm text-[#87938F] mb-6">{erro}</p>
          <a
            href={`/${slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-[#2F9285] hover:text-[#3AA99A] transition-colors"
          >
            <ArrowLeft size={14} />
            Voltar ao perfil
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050B12] text-[#F0EADD] px-6 py-10">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <a
            href={`/${slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-[#87938F] hover:text-[#F0EADD] transition-colors mb-6"
          >
            <ArrowLeft size={14} />
            Voltar ao perfil
          </a>
          <h1 className="text-2xl font-extrabold tracking-tight">Portfólio Completo</h1>
          <p className="text-sm text-[#87938F] mt-1">
            Trabalhos publicados por <span className="text-[#2F9285]">@{slug}</span>
          </p>
        </div>

        {/* Grid de Portfólio */}
        {portfolio.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-[#0B171C] border border-[#243337] rounded-[18px] text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#050B12] border border-[#243337] flex items-center justify-center mb-4">
              <ImageIcon size={22} className="text-[#243337]" />
            </div>
            <p className="text-sm font-medium text-[#87938F]">Nenhum trabalho publicado ainda</p>
            <p className="text-xs text-[#87938F]/60 mt-1">Volte em breve para acompanhar as novidades</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {portfolio.map((item) => (
              <div
                key={item.id}
                onClick={() => setActiveItem(item)}
                className="group relative aspect-square rounded-[14px] overflow-hidden bg-[#0B171C] border border-[#243337] cursor-pointer"
              >
                <img
                  src={`${API_URL}/api/v1/public/${slug}/portfolio/${item.id}/imagem`}
                  alt={item.titulo ?? "Trabalho de portfólio"}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                
                {/* Badge de Estilo se houver */}
                {item.estilo && (
                  <span className="absolute top-3 right-3 text-[9px] font-bold bg-[#2F9285]/80 text-[#050B12] rounded-full px-2 py-0.5 shadow-sm">
                    {item.estilo}
                  </span>
                )}

                {/* Overlay no hover */}
                {(item.titulo || item.parte_corpo) && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col justify-end p-4">
                    {item.titulo && <p className="text-xs font-bold text-white line-clamp-1">{item.titulo}</p>}
                    {item.parte_corpo && <p className="text-[10px] text-[#87938F] mt-0.5">{item.parte_corpo}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Lightbox Modal ─── */}
      {activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          {/* Botão de Fechar */}
          <button
            onClick={() => setActiveItem(null)}
            className="absolute top-4 right-4 p-2 text-[#87938F] hover:text-[#F0EADD] bg-black/60 rounded-full transition-colors border border-[#243337]"
          >
            <X size={20} />
          </button>

          <div className="bg-[#0B171C] border border-[#243337] w-full max-w-lg rounded-[20px] overflow-hidden shadow-2xl flex flex-col">
            {/* Imagem */}
            <div className="relative aspect-square w-full bg-[#050B12] flex items-center justify-center border-b border-[#243337]">
              <img
                src={`${API_URL}/api/v1/public/${slug}/portfolio/${activeItem.id}/imagem`}
                alt={activeItem.titulo ?? "Trabalho"}
                className="max-w-full max-h-full object-contain"
              />
            </div>

            {/* Informações */}
            <div className="p-5 space-y-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  {activeItem.estilo && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#2F9285]/15 text-[#2F9285] border border-[#2F9285]/25">
                      {activeItem.estilo}
                    </span>
                  )}
                  {activeItem.parte_corpo && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#102128] text-[#87938F] border border-[#243337]">
                      {activeItem.parte_corpo}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-[#F0EADD]">{activeItem.titulo || "Trabalho de Portfólio"}</h3>
                {activeItem.descricao && (
                  <p className="text-sm text-[#87938F] mt-1.5 leading-relaxed">{activeItem.descricao}</p>
                )}
              </div>

              {/* CTA para orçamento */}
              <button
                onClick={() => {
                  const refText = `Gostaria de um orçamento baseado no item do portfólio "${activeItem.titulo || 'Sem título'}" (ID: ${activeItem.id})`;
                  router.push(`/${slug}/orcamento?descricao=${encodeURIComponent(refText)}`);
                }}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-[14px] bg-[#2F9285] hover:bg-[#3AA99A] text-[#050B12] font-bold text-sm transition-all"
              >
                <MessageCircle size={16} />
                Quero uma tattoo parecida
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
