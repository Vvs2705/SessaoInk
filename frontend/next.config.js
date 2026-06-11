const { withSentryConfig } = require("@sentry/nextjs");

// URL da API para CSP: em produção nunca deve cair para localhost.
const API_URL =
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://sessaoink-api.fly.dev"
    : "http://localhost:8001");
// Hosts do PostHog Cloud US: app/api legado + ingestão atual (us.i) + assets
// (us-assets.i, que serve o bundle remoto do SDK via script-src).
const POSTHOG_HOSTS =
  "https://app.posthog.com https://us.i.posthog.com https://us-assets.i.posthog.com";

// CSP do frontend. `script-src` inclui 'unsafe-inline' porque o Next.js App
// Router injeta scripts inline de hidratação; sem isso a página fica em branco.
// (Endurecer para nonce/strict-dynamic exige renderização dinâmica em todas as
// rotas — planejado como follow-up; ver docs/security.md.)
//
// `'unsafe-eval'` SÓ em desenvolvimento: o `next dev` (webpack/HMR/source maps)
// avalia bundles via eval. Sem isso a CSP bloqueia o próprio JS do app no dev e
// a página não hidrata (o formulário cai em submit nativo). O build de produção
// NÃO usa eval, então o header de produção permanece estrito.
const isDev = process.env.NODE_ENV !== "production";
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us-assets.i.posthog.com"
  : "script-src 'self' 'unsafe-inline' https://us-assets.i.posthog.com";

const cspHeader = `
  default-src 'self';
  ${scriptSrc};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  font-src 'self';
  connect-src 'self' ${API_URL} ${POSTHOG_HOSTS} https://*.ingest.sentry.io;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
`;

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeader.replace(/\s{2,}/g, " ").trim(),
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,              // sem logs de build do Sentry
  disableLogger: true,
  widenClientFileUpload: true,
  hideSourceMaps: true,      // não expõe source maps ao cliente
  tunnelRoute: "/monitoring", // proxy para evitar bloqueio de ad-blockers
});
