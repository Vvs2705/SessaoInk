"use client";

import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";

import { MOBILE_MORE_ITEMS } from "@/components/layout/navigation";
import { withCsrfHeaders } from "@/lib/api/client";

export default function MaisPage() {
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
        <h1 className="text-2xl font-bold tracking-tight text-[#F0EADD]">
          Mais
        </h1>
        <p className="mt-1 text-sm text-[#87938F]">
          Acesse os módulos complementares do estúdio.
        </p>
      </div>

      <div className="space-y-2">
        {MOBILE_MORE_ITEMS.map(({ href, label, icon: Icon, badge }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center justify-between rounded-2xl border border-[#243337] bg-[#0B171C] p-4 transition-all active:scale-[0.99]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#243337] bg-[#102128]">
                <Icon size={19} className="text-[#2F9285]" />
              </div>

              <span className="truncate text-sm font-semibold text-[#F0EADD]">
                {label}
              </span>
            </div>

            <div className="ml-3 flex shrink-0 items-center gap-2">
              {badge && (
                <span className="rounded-full bg-[#243337] px-2 py-0.5 text-[10px] font-medium text-[#87938F]">
                  {badge}
                </span>
              )}

              <ChevronRight size={17} className="text-[#87938F]" />
            </div>
          </Link>
        ))}

        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-2xl border border-[#E35D5B]/30 bg-[#0B171C] p-4 text-left transition-all active:scale-[0.99]"
        >
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#E35D5B]/25 bg-[#E35D5B]/10">
            <LogOut size={19} className="text-[#E35D5B]" />
          </div>

          <span className="text-sm font-semibold text-[#E35D5B]">Sair</span>
        </button>
      </div>
    </section>
  );
}
