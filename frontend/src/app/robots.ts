import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://sessao-ink.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Bloqueia o app interno e a API — só o portal público e as páginas
        // de marketing devem ser rastreados/indexados.
        disallow: [
          "/api/",
          "/agenda",
          "/atendimentos",
          "/clientes",
          "/configuracoes",
          "/documentos",
          "/estoque",
          "/financeiro",
          "/relatorios",
          "/mais",
          "/portfolio",
          "/flash-arts",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
