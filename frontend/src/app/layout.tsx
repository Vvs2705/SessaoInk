import type { Metadata, Viewport } from "next";
import { Outfit, Fraunces, JetBrains_Mono } from "next/font/google";
import "../styles/globals.css";
import { QueryProvider } from "@/providers/QueryProvider";
import { PostHogProvider } from "@/providers/PostHogProvider";
import { Suspense } from "react";

// Fontes do design system, self-hosted via next/font (sem FOUT, sem request
// extra ao Google). Cada uma amarra sua CSS variable usada em tokens.css.
const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
// Fraunces: serif autoral da direção visual (DESIGN.md) — dá o toque premium
// que combina com tatuagem, aplicada nos títulos do app via --font-display.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600"],
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://sessao-ink.vercel.app";
const TITLE = "SessãoInk | O Sistema Operacional do Tatuador";
const DESCRIPTION =
  "Gerencie clientes, orçamentos, agenda, sinal e documentos do seu estúdio de tatuagem de forma segura e profissional com a SessãoInk.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0B171C",
};

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: TITLE,
    template: "%s | SessãoInk",
  },
  description: DESCRIPTION,
  applicationName: "SessãoInk",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "SessãoInk",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "SessãoInk" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/icon-512.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${outfit.variable} ${fraunces.variable} ${jetbrainsMono.variable} h-full`}
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="SessãoInk" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Em desenvolvimento os chunks do Next não são hasheados e mudam
              // a cada compilação; um SW de cache (network-first) acaba servindo
              // runtime/chunks inconsistentes e quebra a hidratação. Por isso o
              // SW só é registrado em produção. Em dev, desregistra qualquer SW
              // remanescente e limpa o cache para não envenenar a sessão.
              if ('serviceWorker' in navigator) {
                if (${process.env.NODE_ENV === "production"}) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').then(function(reg) {
                      console.log('ServiceWorker registrado com sucesso:', reg.scope);
                    }).catch(function(err) {
                      console.log('Falha ao registrar ServiceWorker:', err);
                    });
                  });
                } else {
                  navigator.serviceWorker.getRegistrations().then(function(regs) {
                    regs.forEach(function(reg) { reg.unregister(); });
                  });
                  if (self.caches && caches.keys) {
                    caches.keys().then(function(keys) {
                      keys.forEach(function(k) { caches.delete(k); });
                    });
                  }
                }
              }
            `
          }}
        />
      </head>
      <body className="h-full bg-ink-night text-porcelain-ink font-sans antialiased overflow-x-hidden">
        <Suspense>
          <PostHogProvider>
            <QueryProvider>{children}</QueryProvider>
          </PostHogProvider>
        </Suspense>
      </body>
    </html>
  );
}
