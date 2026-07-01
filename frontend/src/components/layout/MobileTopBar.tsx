"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, Search, Settings, UserCircle } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";
import { BuscaModal } from "@/components/BuscaModal";
import { cn } from "@/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

export function MobileTopBar() {
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;

    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  return (
    <>
      <header className="safe-top sticky top-0 z-40 border-b border-mist-line bg-ink-bg/95 backdrop-blur-xl lg:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2 active:scale-[0.98]"
            aria-label="Ir para o início"
          >
            <BrandLogo
              layout="icon"
              size="sm"
              scaling={false}
              className="shrink-0"
            />
            <span className="truncate text-sm font-semibold text-porcelain-ink">
              SessãoInk
            </span>
          </Link>

          <div className="flex items-center gap-2">
            {installPrompt && (
              <button
                type="button"
                onClick={handleInstall}
                className={cn(
                  "grid h-10 w-10 place-items-center rounded-full",
                  "border border-teal-ink/40 bg-surface-raised text-teal-ink",
                  "active:scale-95",
                )}
                aria-label="Instalar aplicativo"
              >
                <Download size={18} />
              </button>
            )}

            <button
              type="button"
              onClick={() => setBuscaAberta(true)}
              className={cn(
                "grid h-10 w-10 place-items-center rounded-full",
                "border border-mist-line bg-surface-raised text-text-subtle",
                "active:scale-95",
              )}
              aria-label="Abrir busca"
            >
              <Search size={18} />
            </button>

            <Link
              href="/configuracoes"
              className={cn(
                "grid h-10 w-10 place-items-center rounded-full",
                "border border-mist-line bg-surface-raised text-text-subtle",
                "active:scale-95",
              )}
              aria-label="Abrir configurações"
            >
              <Settings size={18} />
            </Link>

            <Link
              href="/configuracoes"
              className="grid h-10 w-10 place-items-center rounded-full border border-teal-ink/50 bg-surface-raised text-teal-ink active:scale-95"
              aria-label="Perfil"
            >
              <UserCircle size={22} />
            </Link>
          </div>
        </div>
      </header>

      <BuscaModal aberto={buscaAberta} onFechar={() => setBuscaAberta(false)} />
    </>
  );
}
