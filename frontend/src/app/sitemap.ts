import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://sessao-ink.vercel.app";

/**
 * Sitemap das páginas públicas indexáveis.
 *
 * NOTA: os portais públicos dos estúdios (`/[slug]`) deveriam ser incluídos
 * dinamicamente — isso exige um endpoint backend que liste os slugs públicos
 * (ex.: GET /api/v1/public/estudios). Quando existir, mapear aqui com
 * `revalidate` para um sitemap sempre atualizado.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: `${BASE}/precos`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE}/cadastro`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
