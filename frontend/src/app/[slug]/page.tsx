import type { Metadata } from "next";
import { Globe, MessageCircle, Zap, Image as ImageIcon } from "lucide-react";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Estúdio | ${slug} — SessãoInk`,
    description: "Veja o portfólio, flash arts disponíveis e solicite um orçamento.",
    robots: { index: true, follow: true },
  };
}

export default async function PortalPublicoPage({ params }: Props) {
  const { slug } = await params;

  return (
    <div className="min-h-screen bg-[#050B12] text-[#F0EADD]">
      {/* Hero */}
      <section className="relative px-6 py-16 max-w-4xl mx-auto text-center">
        <div className="w-20 h-20 rounded-2xl bg-[#0B171C] border border-[#243337] mx-auto mb-6 flex items-center justify-center">
          <Globe size={32} className="text-[#2F9285]" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Estúdio @{slug}</h1>
        <p className="text-[#87938F] max-w-md mx-auto mb-8">
          Este é o portal público do estúdio. Configure seu perfil no painel para personalizar esta página.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href={`/${slug}/orcamento`}
            className="inline-flex items-center gap-2 h-12 px-6 rounded-[14px] bg-[#2F9285] hover:bg-[#3AA99A] text-[#050B12] font-semibold transition-all"
          >
            <MessageCircle size={18} />
            Pedir Orçamento
          </a>
          <a
            href={`/${slug}/flash-arts`}
            className="inline-flex items-center gap-2 h-12 px-6 rounded-[14px] bg-[#0B171C] border border-[#243337] hover:bg-[#102128] text-[#F0EADD] font-medium transition-all"
          >
            <Zap size={18} className="text-[#C36B3F]" />
            Ver Flash Arts
          </a>
        </div>
      </section>

      {/* Portfólio placeholder */}
      <section className="px-6 pb-16 max-w-4xl mx-auto">
        <h2 className="font-bold text-lg mb-4">Portfólio</h2>
        <div className="flex flex-col items-center justify-center py-16 bg-[#0B171C] border border-[#243337] rounded-[18px] text-center">
          <ImageIcon size={40} className="text-[#243337] mb-3" />
          <p className="text-sm text-[#87938F]">Nenhuma foto publicada ainda</p>
        </div>
      </section>

      {/* Badge de segurança */}
      <footer className="border-t border-[#243337] bg-[#0B171C] px-6 py-8 text-center text-xs text-[#87938F]">
        <p>Powered by <span className="text-[#2F9285] font-semibold">SessãoInk</span> — Suas informações são protegidas e nunca compartilhadas</p>
      </footer>
    </div>
  );
}
