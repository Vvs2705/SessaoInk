import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../styles/globals.css";
import { QueryProvider } from "@/providers/QueryProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

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
      <body className="h-full bg-ink-night text-porcelain-ink font-sans antialiased overflow-x-hidden">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
