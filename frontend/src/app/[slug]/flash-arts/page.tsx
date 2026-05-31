import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Zap, AlertCircle, Tag, Ruler, MapPin } from "lucide-react";
import { notFound } from "next/navigation";

const API_URL = process.env.BACKEND_URL || "https://sessaoink-api.fly.dev";

type Props = { params: Promise<{ slug: string }> };

interface EstudioPublico {
  slug: string;
  nome: string;
  bio: string | null;
}

interface FlashArtPublica {
  id: string;
  titulo: string;
  descricao: string | null;
  preco: number | null;
  tamanho_sugerido: string | null;
  local_recomendado: string | null;
  has_imagem: boolean;
}

async function getEstudio(slug: string): Promise<EstudioPublico | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/public/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getFlashArts(slug: string): Promise<FlashArtPublica[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/public/${slug}/flash-arts`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const estudio = await getEstudio(slug);
  if (!estudio) return { title: "Estúdio não encontrado — SessãoInk" };
  return {
    title: `Flash Arts — ${estudio.nome} — SessãoInk`,
    description: `Veja as flash arts disponíveis de ${estudio.nome} e solicite a sua.`,
  };
}

export default async function FlashArtsPage({ params }: Props) {
  const { slug } = await params;
  const [estudio, flashArts] = await Promise.all([getEstudio(slug), getFlashArts(slug)]);

  if (!estudio) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#050B12] text-[#F0EADD]">
      {/* Header */}
      <div className="max-w-2xl mx-auto px-6 pt-8 pb-4">
        <Link
          href={`/${slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-[#87938F] hover:text-[#F0EADD] transition-colors mb-6"
        >
          <ArrowLeft size={14} />
          Voltar ao perfil
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-[12px] bg-[#0B171C] border border-[#243337] flex items-center justify-center">
            <Zap size={18} className="text-[#C36B3F]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#F0EADD]">Flash Arts</h1>
            <p className="text-sm text-[#87938F]">{estudio.nome}</p>
          </div>
        </div>
        <p className="text-sm text-[#87938F] mt-3">
          Designs prontos para tatuar. Clique em qualquer flash art para solicitar o seu orçamento.
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-[#243337] to-transparent mb-8" />
      </div>

      {/* Conteúdo */}
      <section className="max-w-2xl mx-auto px-6 pb-16">
        {flashArts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-[#0B171C] border border-[#243337] rounded-[18px] text-center">
            <div className="w-14 h-14 rounded-[14px] bg-[#0B171C] border border-[#243337] mx-auto mb-4 flex items-center justify-center">
              <Zap size={24} className="text-[#243337]" />
            </div>
            <p className="text-[#87938F] text-sm mb-1">Nenhuma flash art disponível no momento</p>
            <p className="text-[#87938F] text-xs">Acompanhe as redes sociais do estúdio para novidades</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {flashArts.map((flash) => (
              <Link
                key={flash.id}
                href={`/${slug}/orcamento?flash=${flash.id}&titulo=${encodeURIComponent(flash.titulo)}`}
                className="group bg-[#0B171C] border border-[#243337] rounded-[18px] overflow-hidden hover:border-[#2F9285]/40 transition-all"
              >
                {/* Imagem */}
                <div className="aspect-square bg-[#050B12] relative overflow-hidden flex items-center justify-center">
                  {flash.has_imagem ? (
                    <img
                      src={`/api/v1/public/${slug}/flash-arts/${flash.id}/imagem`}
                      alt={flash.titulo}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <Zap size={32} className="text-[#243337]" />
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-[#F0EADD] text-sm mb-2 group-hover:text-[#2F9285] transition-colors">
                    {flash.titulo}
                  </h3>

                  {flash.descricao && (
                    <p className="text-xs text-[#87938F] mb-3 line-clamp-2">{flash.descricao}</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {flash.preco != null && (
                      <span className="inline-flex items-center gap-1 text-xs text-[#54B88D] bg-[#54B88D]/10 px-2 py-0.5 rounded-full">
                        <Tag size={10} />
                        R$ {flash.preco.toFixed(2).replace(".", ",")}
                      </span>
                    )}
                    {flash.tamanho_sugerido && (
                      <span className="inline-flex items-center gap-1 text-xs text-[#87938F] bg-[#87938F]/10 px-2 py-0.5 rounded-full">
                        <Ruler size={10} />
                        {flash.tamanho_sugerido}
                      </span>
                    )}
                    {flash.local_recomendado && (
                      <span className="inline-flex items-center gap-1 text-xs text-[#87938F] bg-[#87938F]/10 px-2 py-0.5 rounded-full">
                        <MapPin size={10} />
                        {flash.local_recomendado}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-10 text-center">
          <p className="text-sm text-[#87938F] mb-4">Não encontrou o que procura?</p>
          <Link
            href={`/${slug}/orcamento`}
            className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-[14px] bg-[#2F9285] hover:bg-[#3AA99A] text-[#050B12] font-bold text-sm transition-all shadow-[0_0_24px_rgba(47,146,133,0.25)]"
          >
            <MessageCircle size={17} />
            Pedir Orçamento Personalizado
          </Link>
        </div>
      </section>
    </div>
  );
}
