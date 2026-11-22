"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LogOut, Search, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BuscaModal } from "@/components/BuscaModal";
import { BrandLogo } from "@/components/BrandLogo";
import { withCsrfHeaders } from "@/lib/api/client";
import { useRole } from "@/lib/auth/useRole";
import { useContagemAcoes } from "@/lib/useAtendimentos";
import {
  DESKTOP_NAV_ITEMS,
  NAV_GROUP_LABEL,
  NAV_GROUP_ORDER,
  filterNavByRole,
} from "./navigation";

export function Sidebar() {
  const pathname = usePathname();
  const { tipo } = useRole();
  const navItems = filterNavByRole(DESKTOP_NAV_ITEMS, tipo);
  const acoesPendentes = useContagemAcoes();
  const [buscaAberta, setBuscaAberta] = useState(false);

  // Ctrl+K / Cmd+K abre a busca
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setBuscaAberta((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <aside className="hidden lg:flex flex-col w-60 bg-ink-bg border-r border-mist-line h-screen sticky top-0 shrink-0">
        {/* Logo */}
        <div className="flex flex-col items-start px-5 py-5 border-b border-mist-line gap-1">
          <BrandLogo size="md" />
          <span className="px-1 font-mono text-xs text-text-subtle">v1.1</span>
        </div>

        {/* Busca rápida */}
        <div className="px-3 pt-3 pb-1">
          <button
            onClick={() => setBuscaAberta(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-sm bg-ink-night border border-mist-line text-text-subtle hover:border-teal-ink/30 hover:text-porcelain-ink transition-all text-sm"
          >
            <Search size={14} className="shrink-0" />
            <span className="flex-1 text-left text-xs">Buscar…</span>
            <kbd className="rounded-xs border border-mist-line bg-ink-bg px-1 py-0.5 font-mono text-xs">⌘K</kbd>
          </button>
        </div>

        {/* Nav: agrupado por frequência de uso (Operação > Vitrine > Gestão) */}
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-3" aria-label="Navegação principal">
          {NAV_GROUP_ORDER.map((grupo) => {
            const itens = navItems.filter((item) => item.group === grupo);
            if (itens.length === 0) return null;
            return (
              <div key={grupo} className="space-y-0.5">
                <p className="px-3 pb-1 font-mono text-xs uppercase tracking-widest text-text-subtle">
                  {NAV_GROUP_LABEL[grupo]}
                </p>
                {itens.map(({ href, label, icon: Icon }) => {
                  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                  const mostrarSelo = href === "/atendimentos" && acoesPendentes > 0;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "group flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-teal-ink/15 text-teal-ink"
                          : "text-text-subtle hover:bg-surface-raised hover:text-porcelain-ink"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon size={16} aria-hidden="true" className={cn("shrink-0", active ? "text-teal-ink" : "group-hover:text-porcelain-ink")} />
                      <span className="flex-1">{label}</span>
                      {mostrarSelo && (
                        <span
                          className="rounded-pill bg-primary px-1.5 py-0.5 font-mono text-xs font-medium leading-none text-primary-foreground"
                          aria-label={`${acoesPendentes} ${acoesPendentes === 1 ? "item" : "itens"} esperando por você`}
                        >
                          {acoesPendentes}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-mist-line space-y-0.5">
          <Link href="/configuracoes" className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-all group text-text-subtle hover:bg-surface-raised hover:text-porcelain-ink",
            pathname === "/configuracoes" && "bg-teal-ink/15 text-teal-ink"
          )}>
            <Settings size={16} className="shrink-0" />
            Configurações
          </Link>
          <button
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-all text-text-subtle hover:bg-error-red/10 hover:text-error-red"
            onClick={async () => {
              await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/v1/auth/logout`, withCsrfHeaders({ method: "POST", credentials: "include" }));
              window.location.href = "/login";
            }}
          >
            <LogOut size={16} className="shrink-0" />
            Sair
          </button>
        </div>
      </aside>

      {/* Modal de busca */}
      <BuscaModal aberto={buscaAberta} onFechar={() => setBuscaAberta(false)} />
    </>
  );
}
