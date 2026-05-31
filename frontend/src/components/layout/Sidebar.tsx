"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Calendar, ClipboardList, Users, Image, Zap,
  Wallet, Package, FileText, BarChart2, Settings,
  LogOut, Search, BarChart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BuscaModal } from "@/components/BuscaModal";
import { BrandLogo } from "@/components/BrandLogo";

const NAV = [
  { href: "/",              label: "Início",        icon: BarChart2 },
  { href: "/agenda",        label: "Agenda",        icon: Calendar },
  { href: "/atendimentos",  label: "Atendimentos",  icon: ClipboardList },
  { href: "/clientes",      label: "Clientes",      icon: Users },
  { href: "/portfolio",     label: "Portfólio",     icon: Image },
  { href: "/flash-arts",    label: "Flash Arts",    icon: Zap },
  { href: "/financeiro",    label: "Financeiro",    icon: Wallet },
  { href: "/estoque",       label: "Estoque",       icon: Package },
  { href: "/documentos",    label: "Documentos",    icon: FileText },
  { href: "/relatorios",    label: "Relatórios",    icon: BarChart },
];

export function Sidebar() {
  const pathname = usePathname();
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
      <aside className="hidden lg:flex flex-col w-60 bg-[#0B171C] border-r border-[#243337] h-screen sticky top-0 shrink-0">
        {/* Logo */}
        <div className="flex flex-col items-start px-5 py-5 border-b border-[#243337] gap-1">
          <BrandLogo size="md" />
          <span className="text-[10px] text-[#87938F] px-1 font-mono">v1.1</span>
        </div>

        {/* Busca rápida */}
        <div className="px-3 pt-3 pb-1">
          <button
            onClick={() => setBuscaAberta(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-[10px] bg-[#050B12] border border-[#243337] text-[#87938F] hover:border-[#2F9285]/30 hover:text-[#F0EADD] transition-all text-sm"
          >
            <Search size={14} className="shrink-0" />
            <span className="flex-1 text-left text-xs">Buscar…</span>
            <kbd className="text-[10px] bg-[#0B171C] border border-[#243337] px-1 py-0.5 rounded-[4px] font-mono">⌘K</kbd>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto" aria-label="Navegação principal">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-all group",
                  active
                    ? "bg-[#2F9285]/15 text-[#2F9285]"
                    : "text-[#87938F] hover:bg-[#102128] hover:text-[#F0EADD]"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={16} className={cn("shrink-0", active ? "text-[#2F9285]" : "group-hover:text-[#F0EADD]")} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-[#243337] space-y-0.5">
          <Link href="/configuracoes" className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-all group text-[#87938F] hover:bg-[#102128] hover:text-[#F0EADD]",
            pathname === "/configuracoes" && "bg-[#2F9285]/15 text-[#2F9285]"
          )}>
            <Settings size={16} className="shrink-0" />
            Configurações
          </Link>
          <button
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-all text-[#87938F] hover:bg-[#E35D5B]/10 hover:text-[#E35D5B]"
            onClick={async () => {
              await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/v1/auth/logout`, { method: "POST", credentials: "include" });
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
