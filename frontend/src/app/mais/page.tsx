"use client";

import Link from "next/link";
import {
  Image, Zap, Wallet, Package, FileText, BarChart2,
  Settings, LogOut, ChevronRight
} from "lucide-react";
import { withCsrfHeaders } from "@/lib/api/client";

const ITEMS = [
  { href: "/portfolio",     label: "Portfólio",     icon: Image,    badge: null },
  { href: "/flash-arts",    label: "Flash Arts",    icon: Zap,      badge: null },
  { href: "/financeiro",    label: "Financeiro",    icon: Wallet,   badge: null },
  { href: "/estoque",       label: "Estoque",       icon: Package,  badge: null },
  { href: "/documentos",    label: "Documentos",    icon: FileText, badge: null },
  { href: "/relatorios",    label: "Relatórios",    icon: BarChart2,badge: "Em breve" },
  { href: "/configuracoes", label: "Configurações", icon: Settings, badge: null },
];

export default function MaisPage() {
  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-[#F0EADD] mb-6">Mais</h1>
      <div className="space-y-2">
        {ITEMS.map(({ href, label, icon: Icon, badge }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center justify-between p-4 rounded-[14px] bg-[#0B171C] border border-[#243337] hover:bg-[#102128] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#102128] rounded-[10px] border border-[#243337]">
                <Icon size={18} className="text-[#2F9285]" />
              </div>
              <span className="text-sm font-medium text-[#F0EADD]">{label}</span>
            </div>
            <div className="flex items-center gap-2">
              {badge && (
                <span className="text-[10px] bg-[#243337] text-[#87938F] px-2 py-0.5 rounded-full">
                  {badge}
                </span>
              )}
              <ChevronRight size={16} className="text-[#87938F]" />
            </div>
          </Link>
        ))}
        <button
          className="w-full flex items-center gap-3 p-4 rounded-[14px] bg-[#0B171C] border border-[#243337] hover:bg-[#E35D5B]/10 hover:border-[#E35D5B]/30 transition-all"
          onClick={async () => {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/v1/auth/logout`, withCsrfHeaders({ method: "POST", credentials: "include" }));
            window.location.href = "/login";
          }}
        >
          <div className="p-2 bg-[#102128] rounded-[10px] border border-[#243337]">
            <LogOut size={18} className="text-[#E35D5B]" />
          </div>
          <span className="text-sm font-medium text-[#E35D5B]">Sair</span>
        </button>
      </div>
    </div>
  );
}
