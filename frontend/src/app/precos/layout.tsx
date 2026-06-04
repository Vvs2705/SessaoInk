import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Preços e planos para estúdios de tatuagem",
  description:
    "Conheça os planos da SessãoInk — o sistema de gestão para tatuadores e estúdios: agenda, clientes, financeiro, orçamentos e portfólio. Teste grátis por 14 dias.",
  alternates: { canonical: "/precos" },
  openGraph: {
    title: "Preços e planos — SessãoInk",
    description:
      "O sistema de gestão para tatuadores e estúdios de tatuagem. Teste grátis por 14 dias.",
    url: "/precos",
  },
};

export default function PrecosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
