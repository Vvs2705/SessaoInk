import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://sessao-ink.vercel.app";
const API = process.env.BACKEND_URL || "https://sessaoink-api.fly.dev";

interface EstudioSitemap {
  slug: string;
  atualizado_em: string | null;
}

async function getEstudiosPublicos(): Promise<EstudioSitemap[]> {
  try {
    const res = await fetch(`${API}/api/v1/public/estudios`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

/**
 * Sitemap das páginas públicas + portais dos estúdios com conteúdo público
 * (slugs vindos de GET /api/v1/public/estudios). Revalidado de hora em hora.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const estaticas: MetadataRoute.Sitemap = [
    { url: `${BASE}/precos`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/cadastro`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  const portais: MetadataRoute.Sitemap = (await getEstudiosPublicos()).map((e) => ({
    url: `${BASE}/${e.slug}`,
    lastModified: e.atualizado_em ? new Date(e.atualizado_em) : now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...estaticas, ...portais];
}
