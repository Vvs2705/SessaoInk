"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  MOBILE_MORE_ITEMS,
  MOBILE_MORE_TAB_ITEM,
  MOBILE_TAB_ITEMS,
} from "./navigation";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();

  const items = [...MOBILE_TAB_ITEMS, MOBILE_MORE_TAB_ITEM];

  const isActive = (href: string) => {
    if (href === MOBILE_MORE_TAB_ITEM.href) {
      return (
        pathname === "/mais" ||
        MOBILE_MORE_ITEMS.some(
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
        "border-t border-[#243337] bg-[#0B171C]/95 backdrop-blur-xl",
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
                "text-[11px] font-medium transition-colors",
                "active:scale-[0.97]",
                active ? "text-[#2F9285]" : "text-[#87938F]",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={21} strokeWidth={active ? 2.6 : 2} />
              <span className="leading-none">{shortLabel}</span>

              {active && (
                <span className="absolute bottom-1 h-1 w-6 rounded-full bg-[#2F9285]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
