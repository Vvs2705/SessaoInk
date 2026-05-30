"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, ClipboardList, Users, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/agenda",       label: "Agenda",       icon: Calendar },
  { href: "/atendimentos", label: "Atend.",        icon: ClipboardList },
  { href: "/clientes",     label: "Clientes",      icon: Users },
  { href: "/mais",         label: "Mais",          icon: MoreHorizontal },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0B171C] border-t border-[#243337] z-50 safe-bottom"
      aria-label="Navegação mobile"
    >
      <div className="grid grid-cols-4 h-16">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                active ? "text-[#2F9285]" : "text-[#87938F]"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={20} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
