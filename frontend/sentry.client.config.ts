import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === "production",

  // Amostragem de traces de performance
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.05,  // 5% das sessões com replay
  replaysOnErrorSampleRate: 1.0,   // 100% das sessões com erro

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,   // LGPD — ocultar texto nas gravações
      blockAllMedia: false,
    }),
  ],
});
