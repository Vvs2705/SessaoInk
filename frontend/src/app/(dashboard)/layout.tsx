import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#050B12]">
      <Sidebar />
      <main className="flex-1 min-w-0 pb-16 lg:pb-0">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
