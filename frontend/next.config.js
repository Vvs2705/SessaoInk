const { withSentryConfig } = require("@sentry/nextjs");

// URL da API para CSP — usa BACKEND_URL (server-only) em produção, localhost em dev
const API_URL = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";
const POSTHOG_HOST = "https://app.posthog.com";

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  font-src 'self';
  connect-src 'self' ${API_URL} ${POSTHOG_HOST} https://*.ingest.sentry.io;
  frame-ancestors 'none';
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
