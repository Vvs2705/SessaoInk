"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  MOBILE_MORE_ITEMS,
  MOBILE_MORE_TAB_ITEM,
  MOBILE_TAB_ITEMS,
  filterNavByRole,
} from "./navigation";
import { cn } from "@/lib/utils";
import { useRole } from "@/lib/auth/useRole";
import { useContagemAcoes } from "@/lib/useAtendimentos";

export function BottomNav() {
  const pathname = usePathname();
  const { tipo } = useRole();
  const acoesPendentes = useContagemAcoes();

  const tabItems = filterNavByRole(MOBILE_TAB_ITEMS, tipo);
  const moreItems = filterNavByRole(MOBILE_MORE_ITEMS, tipo);
  const items = [...tabItems, MOBILE_MORE_TAB_ITEM];

  const isActive = (href: string) => {
    if (href === MOBILE_MORE_TAB_ITEM.href) {
      return (
        pathname === "/mais" ||
        moreItems.some(
          (item) =>
            pathname === item.href || pathname.startsWith(`${item.href}/`),
        )
      );
    }

    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav
      className={cn(
        "safe-bottom fixed inset-x-0 bottom-0 z-50 lg:hidden",
        "border-t border-mist-line bg-ink-bg/95 backdrop-blur-xl",
      )}
      aria-label="Navegação principal mobile"
    >
      <div className="grid h-16 grid-cols-5">
        {items.map(({ href, shortLabel, icon: Icon }) => {
          const active = isActive(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1",
                "text-xs font-medium transition-colors",
                "active:scale-[0.97]",
                active ? "text-teal-ink" : "text-text-subtle",
              )}
              aria-current={active ? "page" : undefined}
            >
              <span className="relative">
                <Icon size={21} strokeWidth={active ? 2.6 : 2} aria-hidden="true" />
                {href === "/atendimentos" && acoesPendentes > 0 && (
                  <span
                    className="absolute -right-2.5 -top-1.5 min-w-4 rounded-pill bg-primary px-1 text-center font-mono text-xs font-medium leading-4 text-primary-foreground"
                    aria-label={`${acoesPendentes} ${acoesPendentes === 1 ? "item" : "itens"} esperando por você`}
                  >
                    {acoesPendentes}
                  </span>
                )}
              </span>
              <span className="leading-none">{shortLabel}</span>

              {active && (
                <span className="absolute bottom-1 h-1 w-6 rounded-full bg-teal-ink" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
