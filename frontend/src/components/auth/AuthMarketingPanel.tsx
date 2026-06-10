import { CalendarCheck, FileSignature, Image, Wallet } from "lucide-react";

const BENEFICIOS = [
  {
    titulo: "Agenda sem confusão",
    texto: "Organize horários, retornos, sessões e encaixes com clareza.",
    icon: CalendarCheck,
  },
  {
    titulo: "Cliente com histórico",
    texto: "Tenha dados, referências, consentimentos e evolução de cada atendimento.",
    icon: FileSignature,
  },
  {
    titulo: "Financeiro na mão",
    texto: "Acompanhe entradas, pendências, custos e resultados do estúdio.",
    icon: Wallet,
  },
  {
    titulo: "Portal público",
    texto: "Mostre portfólio, flash arts e receba pedidos de orçamento por link.",
    icon: Image,
  },
];

export function AuthMarketingPanel() {
  return (
    <aside className="relative hidden min-h-app overflow-hidden border-r border-[#243337] bg-[#050B12] px-10 py-10 text-[#F0EADD] lg:flex lg:flex-col lg:justify-between">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#2F9285]/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 right-0 h-80 w-80 rounded-full bg-[#C36B3F]/10 blur-3xl" />

      <div className="relative z-10 max-w-xl">
        <div className="mb-8 inline-flex rounded-full border border-[#2F9285]/30 bg-[#2F9285]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#2F9285]">
          SessãoInk
        </div>

        <p className="text-4xl font-black leading-tight tracking-tight xl:text-5xl">
          Gestão feita para tatuadores que querem viver da arte sem se perder na operação.
        </p>

        <p className="mt-5 max-w-lg text-base leading-7 text-[#87938F]">
          Agenda, clientes, atendimentos, financeiro, portfólio, flash arts e documentos em um só lugar.
        </p>
      </div>

      <div className="relative z-10 grid grid-cols-2 gap-4">
        {BENEFICIOS.map(({ titulo, texto, icon: Icon }) => (
          <article
            key={titulo}
            className="rounded-3xl border border-[#243337] bg-[#0B171C]/80 p-5 shadow-2xl shadow-black/20 backdrop-blur"
          >
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl border border-[#2F9285]/25 bg-[#2F9285]/10 text-[#2F9285]">
              <Icon size={21} />
            </div>

            <h2 className="text-sm font-bold text-[#F0EADD]">{titulo}</h2>
            <p className="mt-2 text-xs leading-5 text-[#87938F]">{texto}</p>
          </article>
        ))}
      </div>
    </aside>
  );
}
