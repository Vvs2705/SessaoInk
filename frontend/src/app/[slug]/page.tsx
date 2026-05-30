import type { Metadata } from "next";
import Link from "next/link";
import {
  MapPin,
  Instagram,
  MessageCircle,
  Image as ImageIcon,
  AlertCircle,
  Zap,
} from "lucide-react";
import { notFound } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Props = { params: Promise<{ slug: string }> };

interface EstudioPublico {
  slug: string;
  nome: string;
  bio: string | null;
  cidade: string | null;
  uf: string | null;
  instagram: string | null;
}

interface PortfolioItem {
  id: string;
  titulo: string | null;
  descricao: string | null;
  estilo: string | null;
  parte_corpo: string | null;
  imagem_path: string;
}

async function getEstudio(slug: string): Promise<EstudioPublico | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/public/${slug}`, {
      next: { revalidate: 60 },
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getPortfolio(slug: string): Promise<PortfolioItem[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/public/${slug}/portfolio`, {
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
  if (!estudio) {
    return { title: "Estúdio não encontrado — SessãoInk" };
  }
  return {
    title: `${estudio.nome} — SessãoInk`,
    description: estudio.bio ?? "Veja o portfólio e solicite um orçamento.",
    robots: { index: true, follow: true },
  };
}

export default async function PortalPublicoPage({ params }: Props) {
  const { slug } = await params;
  const [estudio, portfolio] = await Promise.all([
    getEstudio(slug),
    getPortfolio(slug),
  ]);

  if (!estudio) {
    return (
      <div className="min-h-screen bg-[#050B12] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-[#0B171C] border border-[#243337] mx-auto mb-5 flex items-center justify-center">
            <AlertCircle size={28} className="text-[#C36B3F]" />
          </div>
          <h1 className="text-xl font-bold text-[#F0EADD] mb-2">
            Estúdio não encontrado
          </h1>
          <p className="text-sm text-[#87938F]">
            O link que você acessou não corresponde a nenhum estúdio cadastrado
            no SessãoInk.
          </p>
        </div>
      </div>
    );
  }

  const instagramHandle = estudio.instagram?.startsWith("@")
    ? estudio.instagram
    : estudio.instagram
    ? `@${estudio.instagram}`
    : null;

  return (
    <div className="min-h-screen bg-[#050B12] text-[#F0EADD]">
      {/* ── Hero ── */}
      <section className="relative px-6 pt-16 pb-12 max-w-2xl mx-auto text-center">
        {/* Avatar placeholder */}
        <div className="w-24 h-24 rounded-[20px] bg-[#0B171C] border border-[#243337] mx-auto mb-6 flex items-center justify-center shadow-[0_0_40px_rgba(47,146,133,0.12)]">
          <span className="text-3xl font-black text-[#2F9285]">
            {estudio.nome.charAt(0).toUpperCase()}
          </span>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight mb-2">
          {estudio.nome}
        </h1>

        {/* Localização */}
        {(estudio.cidade || estudio.uf) && (
          <div className="flex items-center justify-center gap-1.5 text-sm text-[#87938F] mb-3">
            <MapPin size={14} className="text-[#2F9285]" />
            <span>
              {[estudio.cidade, estudio.uf].filter(Boolean).join(" — ")}
            </span>
          </div>
        )}

        {/* Instagram */}
        {instagramHandle && (
          <a
            href={`https://instagram.com/${instagramHandle.replace("@", "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-[#87938F] hover:text-[#F0EADD] transition-colors mb-5"
          >
            <Instagram size={14} className="text-[#C36B3F]" />
            {instagramHandle}
          </a>
        )}

        {/* Bio */}
        {estudio.bio && (
          <p className="text-[#B8C2BF] text-base max-w-md mx-auto mb-8 leading-relaxed">
            {estudio.bio}
          </p>
        )}

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={`/${slug}/orcamento`}
            className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-[14px] bg-[#2F9285] hover:bg-[#3AA99A] text-[#050B12] font-bold text-sm transition-all shadow-[0_0_24px_rgba(47,146,133,0.25)] hover:shadow-[0_0_32px_rgba(47,146,133,0.4)]"
          >
            <MessageCircle size={17} />
            Pedir Orçamento
          </Link>
          <Link
            href={`/${slug}/flash-arts`}
            className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-[14px] bg-[#0B171C] border border-[#243337] hover:bg-[#102128] hover:border-[#2F9285]/40 text-[#F0EADD] font-medium text-sm transition-all"
          >
            <Zap size={17} className="text-[#C36B3F]" />
            Ver Flash Arts
          </Link>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="max-w-2xl mx-auto px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-[#243337] to-transparent" />
      </div>

      {/* ── Portfólio ── */}
      <section className="px-6 py-12 max-w-2xl mx-auto">
        <h2 className="font-bold text-lg mb-5 text-[#F0EADD]">Portfólio</h2>

        {portfolio.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-[#0B171C] border border-[#243337] rounded-[18px] text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#050B12] border border-[#243337] flex items-center justify-center mb-4">
              <ImageIcon size={22} className="text-[#243337]" />
            </div>
            <p className="text-sm font-medium text-[#87938F]">
              Nenhuma foto publicada ainda
            </p>
            <p className="text-xs text-[#87938F]/60 mt-1">
              Volte em breve para conferir o trabalho do artista
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {portfolio.map((item) => (
              <div
                key={item.id}
                className="group relative aspect-square rounded-[14px] overflow-hidden bg-[#0B171C] border border-[#243337]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${API_URL}/api/v1/public/${slug}/portfolio/${item.id}/imagem`}
                  alt={item.titulo ?? "Trabalho do portfólio"}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {/* Overlay on hover */}
                {(item.titulo || item.estilo) && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-3">
                    {item.titulo && (
                      <p className="text-xs font-semibold text-white line-clamp-2">
                        {item.titulo}
                      </p>
                    )}
                    {item.estilo && (
                      <span className="ml-auto shrink-0 text-[10px] bg-[#2F9285]/80 text-white rounded-full px-2 py-0.5">
                        {item.estilo}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#243337] bg-[#0B171C] px-6 py-8 text-center text-xs text-[#87938F]">
        <p>
          Powered by{" "}
          <span className="text-[#2F9285] font-semibold">SessãoInk</span> —
          Suas informações são protegidas e nunca compartilhadas
        </p>
      </footer>
    </div>
  );
}
