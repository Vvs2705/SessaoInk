import Link from "next/link";
import type { Metadata } from "next";
import { Home } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";

export const metadata: Metadata = {
  title: "Página não encontrada",
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink-night px-4 py-12 text-center">
      <div className="w-full max-w-md motion-safe:animate-fade-in">
        <BrandLogo size="lg" className="mx-auto" scaling={false} />

        <p className="mt-8 font-display text-5xl font-semibold text-teal-ink">
          404
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-porcelain-ink">
          Página não encontrada
        </h1>
        <p className="mt-3 text-sm leading-6 text-text-subtle">
          A página que você procura não existe, mudou de endereço ou nunca
          esteve por aqui.
        </p>

        <div className="mt-8 flex justify-center">
          <Link
            href="/"
            className="flex h-12 items-center justify-center gap-2 rounded-lg bg-teal-ink px-6 font-bold text-ink-night transition hover:bg-ink-gold"
          >
            <Home size={18} />
            Voltar ao início
          </Link>
        </div>
      </div>
    </main>
  );
}
