import type { ReactNode } from "react";

import { AssinaturaBanner } from "@/components/layout/AssinaturaBanner";
import { BottomNav } from "@/components/layout/BottomNav";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { MfaEnforcementGate } from "@/components/MfaEnforcementGate";
import { PageGuide } from "@/components/PageGuide";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-app bg-ink-night text-porcelain-ink lg:flex">
      <Sidebar />

      <div className="flex min-h-app min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <AssinaturaBanner />

        <main className="pb-mobile-nav flex-1 px-4 py-4 sm:px-5 lg:px-8 lg:py-8 lg:pb-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>

      <BottomNav />
      <PageGuide />
      <MfaEnforcementGate />
    </div>
  );
}
