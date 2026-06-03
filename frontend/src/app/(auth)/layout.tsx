import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-app bg-[#050B12] text-[#F0EADD]">
      {children}
    </main>
  );
}
