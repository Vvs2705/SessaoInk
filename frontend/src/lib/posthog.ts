import posthog from "posthog-js";

export function initPostHog() {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  if (posthog.__loaded) return;

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    session_recording: {
      maskAllInputs: true,        // LGPD — oculta conteúdo de inputs
      maskInputOptions: {
        password: true,
        email: true,
      },
    },
    // Não capturar em desenvolvimento
    loaded: (ph) => {
      if (process.env.NODE_ENV === "development") ph.opt_out_capturing();
    },
  });
}

export function captureAppEvent(
  event: string,
  properties?: Record<string, string | number | boolean | null | undefined>
) {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  if (!posthog.__loaded) return;
  posthog.capture(event, properties);
}

export { posthog };
