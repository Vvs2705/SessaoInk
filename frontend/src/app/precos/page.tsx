"use client";

import { useEffect, useState } from "react";
import { Check, X, Star } from "lucide-react";

type Recurso = { label: string; incluso: boolean; detalhe: string | null };
type Ciclo = {
  ciclo: string;
  label: string;
  meses: number;
  preco_cheio: number;
  pix_total: number;
  desconto_pix_pct: number;
  cartao_total: number;
  cartao_max_parcelas: number;
  cartao_parcela: number;
  cartao_juros: boolean;
  obs: string;
};
type Plano = {
  slug: string;
  nome: string;
  preco_mensal: number;
  destaque: boolean;
  badge?: string;
  publico_alvo: string;
  descricao: string;
  recursos: Recurso[];
  tabela_precos: Ciclo[];
  promocao?: { preco_promocional: number; meses: number; descricao: string };
};

const CICLOS = [
  { chave: "mensal", label: "Mensal" },
  { chave: "trimestral", label: "Trimestral" },
  { chave: "semestral", label: "Semestral" },
  { chave: "anual", label: "Anual" },
];

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PrecosPage() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [trialDias, setTrialDias] = useState(14);
  const [ciclo, setCiclo] = useState("mensal");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [leadPlano, setLeadPlano] = useState<Plano | null>(null);

  useEffect(() => {
    fetch("/api/v1/public/planos")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        setPlanos(d.planos);
        setTrialDias(d.trial_dias ?? 14);
      })
      .catch(() => setErro(true))
      .finally(() => setCarregando(false));
  }, []);

  return (
    <main className="min-h-screen bg-[#050B12] text-[#F0EADD] px-4 py-12 sm:py-16">
      <div className="max-w-5xl mx-auto">
        <header className="text-center mb-8">
          <p className="text-[11px] uppercase tracking-[3px] text-[#2F9285] font-semibold mb-2">
            SessãoInk
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">
            Planos para o seu estúdio
          </h1>
          <p className="text-[#87938F] max-w-xl mx-auto">
            {trialDias} dias grátis no Profissional. Cancele quando quiser. Pix com desconto
            em todos os ciclos.
          </p>
        </header>

        {/* Seletor de ciclo */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex flex-wrap gap-1 p-1 rounded-[14px] bg-[#0B171C] border border-[#243337]">
            {CICLOS.map((c) => (
              <button
                key={c.chave}
                onClick={() => setCiclo(c.chave)}
                className={`px-4 py-2 rounded-[10px] text-sm font-medium transition-colors ${
                  ciclo === c.chave
                    ? "bg-[#2F9285] text-[#050B12]"
                    : "text-[#87938F] hover:text-[#F0EADD]"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {carregando && (
          <p className="text-center text-[#87938F]">Carregando planos…</p>
        )}
        {erro && (
          <p className="text-center text-[#E35D5B]">
            Não foi possível carregar os planos. Tente recarregar a página.
          </p>
        )}

        {!carregando && !erro && (
          <div className="grid gap-5 md:grid-cols-3">
            {planos.map((p) => {
              const t =
                p.tabela_precos.find((x) => x.ciclo === ciclo) ??
                p.tabela_precos[0];
              return (
                <div
                  key={p.slug}
                  className={`relative flex flex-col rounded-[18px] border p-6 ${
                    p.destaque
                      ? "border-[#2F9285] bg-[#0B171C] shadow-lg shadow-[#2F9285]/10"
                      : "border-[#243337] bg-[#0B171C]"
                  }`}
                >
                  {p.destaque && p.badge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#2F9285] text-[#050B12] text-[11px] font-bold uppercase tracking-wide">
                      <Star size={12} /> {p.badge}
                    </span>
                  )}

                  <h2 className="text-lg font-bold">{p.nome}</h2>
                  <p className="text-xs text-[#87938F] mb-4">{p.publico_alvo}</p>

                  {/* Preço */}
                  <div className="mb-1">
                    <span className="text-3xl font-extrabold">
                      {brl(t.pix_total)}
                    </span>
                    {t.meses > 1 && (
                      <span className="text-[#87938F] text-sm"> /{t.meses}m no Pix</span>
                    )}
                    {t.meses === 1 && (
                      <span className="text-[#87938F] text-sm"> /mês</span>
                    )}
                  </div>
                  {t.desconto_pix_pct > 0 && (
                    <p className="text-xs text-[#2F9285] mb-1">
                      {t.desconto_pix_pct}% off no Pix (de {brl(t.preco_cheio)})
                    </p>
                  )}
                  {t.meses > 1 && (
                    <p className="text-xs text-[#87938F] mb-1">
                      ou {t.cartao_max_parcelas}x de {brl(t.cartao_parcela)} no cartão
                      {t.cartao_juros ? " (com juros)" : " sem juros"}
                    </p>
                  )}
                  {ciclo === "mensal" && p.promocao && (
                    <p className="text-xs text-[#C36B3F] mb-1">
                      {p.promocao.descricao}
                    </p>
                  )}

                  <button
                    onClick={() => setLeadPlano(p)}
                    className={`mt-4 mb-5 w-full py-2.5 rounded-[12px] font-semibold text-sm transition-colors ${
                      p.destaque
                        ? "bg-[#2F9285] text-[#050B12] hover:bg-[#34a394]"
                        : "bg-[#102128] text-[#F0EADD] border border-[#243337] hover:border-[#2F9285]/40"
                    }`}
                  >
                    Tenho interesse
                  </button>

                  <ul className="space-y-2 text-sm">
                    {p.recursos.map((r, i) => (
                      <li key={i} className="flex gap-2">
                        {r.incluso ? (
                          <Check size={16} className="text-[#2F9285] shrink-0 mt-0.5" />
                        ) : (
                          <X size={16} className="text-[#4a5a5f] shrink-0 mt-0.5" />
                        )}
                        <span className={r.incluso ? "" : "text-[#5a6a6f] line-through"}>
                          {r.label}
                          {r.detalhe && (
                            <span className="text-[#87938F]"> — {r.detalhe}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-[#87938F] mt-10">
          Pagamento via Pix, cartão (parcelado) ou boleto. Os valores de Pix já incluem o
          desconto do ciclo escolhido.
        </p>
      </div>

      {leadPlano && (
        <LeadModal plano={leadPlano} ciclo={ciclo} onFechar={() => setLeadPlano(null)} />
      )}
    </main>
  );
}

function LeadModal({
  plano,
  ciclo,
  onFechar,
}: {
  plano: Plano;
  ciclo: string;
  onFechar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch("/api/v1/public/planos/interesse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          contato,
          plano: plano.slug,
          ciclo,
          mensagem: mensagem || null,
          website,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.detail ?? "Não foi possível enviar. Tente novamente.");
      }
      setOk(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao enviar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Interesse no plano ${plano.nome}`}
    >
      <div className="absolute inset-0 bg-black/60" onClick={onFechar} />
      <div className="relative w-full max-w-md rounded-[18px] bg-[#0B171C] border border-[#243337] p-6">
        <button
          onClick={onFechar}
          aria-label="Fechar"
          className="absolute top-4 right-4 text-[#87938F] hover:text-[#F0EADD]"
        >
          <X size={18} />
        </button>

        {ok ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-[#2F9285]/15 text-[#2F9285] flex items-center justify-center mx-auto mb-3">
              <Check size={24} />
            </div>
            <h3 className="font-bold text-lg mb-1">Interesse enviado!</h3>
            <p className="text-sm text-[#87938F]">
              Recebemos seu contato e retornaremos em breve.
            </p>
            <button
              onClick={onFechar}
              className="mt-5 px-5 py-2 rounded-[12px] bg-[#2F9285] text-[#050B12] font-semibold text-sm"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={enviar}>
            <h3 className="font-bold text-lg mb-1">Plano {plano.nome}</h3>
            <p className="text-sm text-[#87938F] mb-4">
              Deixe seu contato que falamos com você sobre a assinatura.
            </p>

            <label className="block text-xs text-[#87938F] mb-1">Nome</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              minLength={2}
              className="w-full h-11 px-3.5 mb-3 rounded-[12px] bg-[#050B12] border border-[#243337] text-sm text-[#F0EADD] focus:border-[#2F9285]/60 outline-none"
            />

            <label className="block text-xs text-[#87938F] mb-1">
              WhatsApp ou e-mail
            </label>
            <input
              value={contato}
              onChange={(e) => setContato(e.target.value)}
              required
              minLength={5}
              className="w-full h-11 px-3.5 mb-3 rounded-[12px] bg-[#050B12] border border-[#243337] text-sm text-[#F0EADD] focus:border-[#2F9285]/60 outline-none"
            />

            <label className="block text-xs text-[#87938F] mb-1">
              Mensagem (opcional)
            </label>
            <textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2.5 mb-3 rounded-[12px] bg-[#050B12] border border-[#243337] text-sm text-[#F0EADD] focus:border-[#2F9285]/60 outline-none resize-none"
            />

            {/* Honeypot anti-spam (oculto) */}
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hidden"
            />

            {erro && <p className="text-sm text-[#E35D5B] mb-3">{erro}</p>}

            <button
              type="submit"
              disabled={enviando}
              className="w-full py-2.5 rounded-[12px] bg-[#2F9285] text-[#050B12] font-semibold text-sm hover:bg-[#34a394] disabled:opacity-60"
            >
              {enviando ? "Enviando…" : "Enviar interesse"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
