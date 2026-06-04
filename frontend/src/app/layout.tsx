import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "../styles/globals.css";
import { QueryProvider } from "@/providers/QueryProvider";
import { PostHogProvider } from "@/providers/PostHogProvider";
import { Suspense } from "react";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0B171C",
};

export const metadata: Metadata = {
  title: "SessãoInk | O Sistema Operacional do Tatuador",
  description: "Gerencie seus clientes, orçamentos, agenda, sinal e documentos de forma segura e profissional com a SessãoInk.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full`}>
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
