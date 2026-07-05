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
      <div className="min-h-screen bg-ink-night flex flex-col items-center justify-center p-6">
        <Loader2 size={32} className="text-teal-ink animate-spin mb-4" />
        <p className="text-sm text-text-subtle">Carregando portfólio...</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="min-h-screen bg-ink-night flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-lg bg-ink-bg border border-mist-line mx-auto mb-5 flex items-center justify-center">
            <AlertCircle size={28} className="text-error-red" />
          </div>
          <h1 className="text-xl font-bold text-porcelain-ink mb-2">Erro ao carregar portfólio</h1>
          <p className="text-sm text-text-subtle mb-6">{erro}</p>
          <a
            href={`/${slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-teal-ink hover:text-ink-gold transition-colors"
          >
            <ArrowLeft size={14} />
            Voltar ao perfil
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-night text-porcelain-ink px-6 py-10">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <a
            href={`/${slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-text-subtle hover:text-porcelain-ink transition-colors mb-6"
          >
            <ArrowLeft size={14} />
            Voltar ao perfil
          </a>
          <h1 className="text-2xl font-extrabold tracking-tight">Portfólio Completo</h1>
          <p className="text-sm text-text-subtle mt-1">
            Trabalhos publicados por <span className="text-teal-ink">@{slug}</span>
          </p>
        </div>

        {/* Grid de Portfólio */}
        {portfolio.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-ink-bg border border-mist-line rounded-[18px] text-center">
            <div className="w-14 h-14 rounded-lg bg-ink-night border border-mist-line flex items-center justify-center mb-4">
              <ImageIcon size={22} className="text-mist-line" />
            </div>
            <p className="text-sm font-medium text-text-subtle">Nenhum trabalho publicado ainda</p>
            <p className="text-xs text-text-subtle/60 mt-1">Volte em breve para acompanhar as novidades</p>
          </div>
        ) : (
          /* Masonry: cada arte aparece na proporção original, como numa galeria —
             colunas CSS, sem corte quadrado. */
          <div className="columns-2 sm:columns-3 gap-4 [column-fill:_balance]">
            {portfolio.map((item) => (
              <div
                key={item.id}
                onClick={() => setActiveItem(item)}
                className="group relative mb-4 break-inside-avoid rounded-[14px] overflow-hidden bg-ink-bg border border-mist-line cursor-pointer hover:border-teal-ink/50 hover:shadow-[0_10px_36px_rgba(0,0,0,0.5)] transition-all duration-300"
              >
                <img
                  src={`${API_URL}/api/v1/public/${slug}/portfolio/${item.id}/imagem`}
                  alt={item.titulo ?? "Trabalho de portfólio"}
                  loading="lazy"
                  className="w-full h-auto object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                />
                
                {/* Badge de Estilo se houver */}
                {item.estilo && (
                  <span className="absolute top-3 right-3 text-[9px] font-bold bg-teal-ink/80 text-ink-night rounded-full px-2 py-0.5 shadow-sm">
                    {item.estilo}
                  </span>
                )}

                {/* Overlay no hover */}
                {(item.titulo || item.parte_corpo) && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col justify-end p-4">
                    {item.titulo && <p className="text-xs font-bold text-white line-clamp-1">{item.titulo}</p>}
                    {item.parte_corpo && <p className="text-[10px] text-text-subtle mt-0.5">{item.parte_corpo}</p>}
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
            className="absolute top-4 right-4 p-2 text-text-subtle hover:text-porcelain-ink bg-black/60 rounded-full transition-colors border border-mist-line"
          >
            <X size={20} />
          </button>

          <div className="bg-ink-bg border border-mist-line w-full max-w-lg rounded-[20px] overflow-hidden shadow-popover flex flex-col">
            {/* Imagem */}
            <div className="relative aspect-square w-full bg-ink-night flex items-center justify-center border-b border-mist-line">
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
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-ink/15 text-teal-ink border border-teal-ink/25">
                      {activeItem.estilo}
                    </span>
                  )}
                  {activeItem.parte_corpo && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-raised text-text-subtle border border-mist-line">
                      {activeItem.parte_corpo}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-porcelain-ink">{activeItem.titulo || "Trabalho de Portfólio"}</h3>
                {activeItem.descricao && (
                  <p className="text-sm text-text-subtle mt-1.5 leading-relaxed">{activeItem.descricao}</p>
                )}
              </div>

              {/* CTA para orçamento */}
              <button
                onClick={() => {
                  const refText = `Gostaria de um orçamento baseado no item do portfólio "${activeItem.titulo || 'Sem título'}" (ID: ${activeItem.id})`;
                  router.push(`/${slug}/orcamento?descricao=${encodeURIComponent(refText)}`);
                }}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-[14px] bg-teal-ink hover:bg-ink-gold text-ink-night font-bold text-sm transition-all"
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
