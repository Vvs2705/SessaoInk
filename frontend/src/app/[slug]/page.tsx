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
import { BrandLogo } from "@/components/BrandLogo";

const API_URL = process.env.BACKEND_URL || "https://sessaoink-api.fly.dev";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://sessao-ink.vercel.app";

type Props = { params: Promise<{ slug: string }> };

interface EstudioPublico {
  slug: string;
  nome: string;
  bio: string | null;
  cidade: string | null;
  uf: string | null;
  instagram: string | null;
  has_logo: boolean;
  has_foto: boolean;
  endereco_completo: string | null;
  como_chegar_url: string | null;
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
    return { title: "Estúdio não encontrado", robots: { index: false, follow: false } };
  }
  const local = [estudio.cidade, estudio.uf].filter(Boolean).join(" — ");
  const description =
    estudio.bio ??
    `Veja o portfólio de ${estudio.nome}${local ? ` em ${local}` : ""} e solicite seu orçamento de tatuagem.`;
  const ogImage = estudio.has_foto
    ? `${APP_URL}/api/v1/public/${slug}/foto`
    : estudio.has_logo
    ? `${APP_URL}/api/v1/public/${slug}/logo`
    : "/icon-512.png";
  return {
    title: estudio.nome,
    description,
    robots: { index: true, follow: true },
    alternates: { canonical: `/${slug}` },
    openGraph: {
      type: "profile",
      title: estudio.nome,
      description,
      url: `/${slug}`,
      images: [{ url: ogImage, alt: estudio.nome }],
    },
  };
}

function estudioJsonLd(estudio: EstudioPublico, slug: string) {
  const image = estudio.has_foto
    ? `${APP_URL}/api/v1/public/${slug}/foto`
    : estudio.has_logo
    ? `${APP_URL}/api/v1/public/${slug}/logo`
    : undefined;
  const handle = estudio.instagram?.replace(/^@/, "");
  return {
    "@context": "https://schema.org",
    "@type": "TattooParlor",
    name: estudio.nome,
    url: `${APP_URL}/${slug}`,
    ...(estudio.bio ? { description: estudio.bio } : {}),
    ...(image ? { image } : {}),
    ...(estudio.endereco_completo || estudio.cidade
      ? {
          address: {
            "@type": "PostalAddress",
            ...(estudio.endereco_completo
              ? { streetAddress: estudio.endereco_completo }
              : {}),
            ...(estudio.cidade ? { addressLocality: estudio.cidade } : {}),
            ...(estudio.uf ? { addressRegion: estudio.uf } : {}),
            addressCountry: "BR",
          },
        }
      : {}),
    ...(handle ? { sameAs: [`https://instagram.com/${handle}`] } : {}),
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
      <div className="min-h-screen bg-ink-night flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-ink-bg border border-mist-line mx-auto mb-5 flex items-center justify-center">
            <AlertCircle size={28} className="text-copper-needle" />
          </div>
          <h1 className="text-xl font-bold text-porcelain-ink mb-2">
            Estúdio não encontrado
          </h1>
          <p className="text-sm text-text-subtle">
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

  const maxHomeItems = 6;
  const portfolioLimitada = portfolio.slice(0, maxHomeItems);

  return (
    <div className="min-h-screen bg-ink-night text-porcelain-ink">
      {/* Dados estruturados (rich results — negócio local de tatuagem).
          Escapa `<` para impedir breakout de </script> via bio/nome do estúdio
          (campos controlados pelo dono) — defesa contra XSS armazenado. */}
      {/* nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(estudioJsonLd(estudio, slug)).replace(
            /</g,
            "\\u003c",
          ),
        }}
      />
      {/* ── Hero ── */}
      <section className="relative px-6 pt-16 pb-12 max-w-2xl mx-auto text-center">
        {/* Logo do estúdio */}
        {estudio.has_logo && (
          <div className="mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/v1/public/${slug}/logo`}
              alt={`Logo de ${estudio.nome}`}
              className="max-h-16 w-auto object-contain mx-auto"
            />
          </div>
        )}

        {/* Foto / Avatar do estúdio */}
        <div className="w-24 h-24 rounded-[20px] bg-ink-bg border border-mist-line mx-auto mb-6 flex items-center justify-center overflow-hidden shadow-[0_0_40px_rgba(47,146,133,0.12)]">
          {estudio.has_foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/v1/public/${slug}/foto`}
              alt={estudio.nome}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-3xl font-black text-teal-ink">
              {estudio.nome.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight mb-2">
          {estudio.nome}
        </h1>

        {/* Localização */}
        {(estudio.endereco_completo || estudio.cidade || estudio.uf) && (
          <div className="mt-4 flex flex-col items-center gap-3 mb-4">
            <div className="flex max-w-xl items-center justify-center gap-2 text-center text-sm text-text-subtle">
              <MapPin size={16} className="shrink-0 text-teal-ink" />
              <span>
                {estudio.endereco_completo ||
                  [estudio.cidade, estudio.uf].filter(Boolean).join(" — ")}
              </span>
            </div>

            {estudio.como_chegar_url && (
              <a
                href={estudio.como_chegar_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center rounded-full border border-teal-ink/30 bg-teal-ink/10 px-5 text-xs font-bold text-teal-ink transition hover:bg-teal-ink hover:text-ink-night"
              >
                Como chegar
              </a>
            )}
          </div>
        )}

        {/* Instagram */}
        {instagramHandle && (
          <a
            href={`https://instagram.com/${instagramHandle.replace("@", "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-text-subtle hover:text-porcelain-ink transition-colors mb-5"
          >
            <Instagram size={14} className="text-copper-needle" />
            {instagramHandle}
          </a>
        )}

        {/* Bio */}
        {estudio.bio && (
          <p className="text-smoke-text text-base max-w-md mx-auto mb-8 leading-relaxed">
            {estudio.bio}
          </p>
        )}

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={`/${slug}/orcamento`}
            className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-[14px] bg-teal-ink hover:bg-ink-gold text-ink-night font-bold text-sm transition-all shadow-[0_0_24px_rgba(47,146,133,0.25)] hover:shadow-[0_0_32px_rgba(47,146,133,0.4)]"
          >
            <MessageCircle size={17} />
            Pedir Orçamento
          </Link>
          <Link
            href={`/${slug}/flash-arts`}
            className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-[14px] bg-ink-bg border border-mist-line hover:bg-surface-raised hover:border-teal-ink/40 text-porcelain-ink font-medium text-sm transition-all"
          >
            <Zap size={17} className="text-copper-needle" />
            Ver Flash Arts
          </Link>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="max-w-2xl mx-auto px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-mist-line to-transparent" />
      </div>

      {/* ── Portfólio ── */}
      <section className="px-6 py-12 max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-bold text-lg text-porcelain-ink">Portfólio</h2>
          {portfolio.length > 0 && (
            <Link
              href={`/${slug}/portfolio`}
              className="text-xs text-teal-ink hover:underline"
            >
              Ver tudo
            </Link>
          )}
        </div>

        {portfolio.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-ink-bg border border-mist-line rounded-[18px] text-center">
            <div className="w-14 h-14 rounded-2xl bg-ink-night border border-mist-line flex items-center justify-center mb-4">
              <ImageIcon size={22} className="text-mist-line" />
            </div>
            <p className="text-sm font-medium text-text-subtle">
              Nenhuma foto publicada ainda
            </p>
            <p className="text-xs text-text-subtle/60 mt-1">
              Volte em breve para conferir o trabalho do artista
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {portfolioLimitada.map((item) => (
              <Link
                key={item.id}
                href={`/${slug}/portfolio`}
                className="group relative aspect-square rounded-[14px] overflow-hidden bg-ink-bg border border-mist-line cursor-pointer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  /* same-origin (proxy): o backend cross-origin é bloqueado pelo CSP img-src 'self' */
                  src={`/api/v1/public/${slug}/portfolio/${item.id}/imagem`}
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
                      <span className="ml-auto shrink-0 text-[10px] bg-teal-ink/80 text-white rounded-full px-2 py-0.5">
                        {item.estilo}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-mist-line bg-ink-bg px-6 py-8 flex flex-col items-center justify-center gap-3 text-xs text-text-subtle">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-subtle/60">Powered by</span>
          <BrandLogo size="sm" scaling={false} />
        </div>
        <p>
          Suas informações são protegidas e nunca compartilhadas
        </p>
      </footer>
    </div>
  );
}
