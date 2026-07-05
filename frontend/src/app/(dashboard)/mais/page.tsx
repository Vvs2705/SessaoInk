"use client";

import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";

import { MOBILE_MORE_ITEMS, filterNavByRole } from "@/components/layout/navigation";
import { withCsrfHeaders } from "@/lib/api/client";
import { useRole } from "@/lib/auth/useRole";

export default function MaisPage() {
  const { tipo } = useRole();
  const moreItems = filterNavByRole(MOBILE_MORE_ITEMS, tipo);

  const handleLogout = async () => {
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/v1/auth/logout`,
        withCsrfHeaders({
          method: "POST",
          credentials: "include",
        }),
      );
    } finally {
      window.location.href = "/login";
    }
  };

  return (
    <section className="mx-auto w-full max-w-lg">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-porcelain-ink">
          Mais
        </h1>
        <p className="mt-1 text-sm text-text-subtle">
          Acesse os módulos complementares do estúdio.
        </p>
      </div>

      <div className="space-y-2">
        {moreItems.map(({ href, label, icon: Icon, badge }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center justify-between rounded-lg border border-mist-line bg-ink-bg p-4 transition-all active:scale-[0.99]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-mist-line bg-surface-raised">
                <Icon size={19} className="text-teal-ink" />
              </div>

              <span className="truncate text-sm font-semibold text-porcelain-ink">
                {label}
              </span>
            </div>

            <div className="ml-3 flex shrink-0 items-center gap-2">
              {badge && (
                <span className="rounded-full bg-mist-line px-2 py-0.5 text-[10px] font-medium text-text-subtle">
                  {badge}
                </span>
              )}

              <ChevronRight size={17} className="text-text-subtle" />
            </div>
          </Link>
        ))}

        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg border border-error-red/30 bg-ink-bg p-4 text-left transition-all active:scale-[0.99]"
        >
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-error-red/25 bg-error-red/10">
            <LogOut size={19} className="text-error-red" />
          </div>

          <span className="text-sm font-semibold text-error-red">Sair</span>
        </button>
      </div>
    </section>
  );
}
