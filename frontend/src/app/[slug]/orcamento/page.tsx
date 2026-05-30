"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  Shield,
  CheckCircle,
  Loader2,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const ESTILOS = [
  "Realismo",
  "Old School",
  "Aquarela",
  "Geométrico",
  "Oriental",
  "Tribal",
  "Lettering",
  "Outro",
];

interface OrcamentoResponse {
  protocolo: string;
  atendimento_id: string;
  mensagem: string;
}

interface FormState {
  nome: string;
  whatsapp: string;
  instagram: string;
  descricao: string;
  estilo: string;
  parte_corpo: string;
  tamanho_cm: string;
  aceite_privacidade: boolean;
  aceite_termos: boolean;
}

const inputClass =
  "w-full h-11 px-3.5 rounded-[14px] bg-[#050B12] border border-[#243337] text-[#F0EADD] text-sm placeholder-[#87938F]/70 focus:outline-none focus:border-[#2F9285]/60 transition-colors";

const selectClass =
  "w-full h-11 px-3.5 rounded-[14px] bg-[#050B12] border border-[#243337] text-[#F0EADD] text-sm focus:outline-none focus:border-[#2F9285]/60 transition-colors appearance-none cursor-pointer";

const labelClass = "block text-sm font-medium text-[#B8C2BF] mb-1.5";

export default function OrcamentoPage() {
  const params = useParams();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug ?? "";

  const [form, setForm] = useState<FormState>({
    nome: "",
    whatsapp: "",
    instagram: "",
    descricao: "",
    estilo: "",
    parte_corpo: "",
    tamanho_cm: "",
    aceite_privacidade: false,
    aceite_termos: false,
  });
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<OrcamentoResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const podeEnviar =
    form.nome.trim() &&
    form.whatsapp.trim() &&
    form.descricao.trim() &&
    form.aceite_privacidade &&
    form.aceite_termos;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!podeEnviar) return;

    setEnviando(true);
    setErro(null);

    try {
      const body = {
        nome: form.nome.trim(),
        whatsapp: form.whatsapp.trim(),
        instagram: form.instagram.trim() || null,
        descricao: form.descricao.trim(),
        estilo: form.estilo || null,
        parte_corpo: form.parte_corpo.trim() || null,
        tamanho_cm: form.tamanho_cm.trim() || null,
        aceite_privacidade: true,
        aceite_termos: true,
      };

      const res = await fetch(
        `${API_URL}/api/v1/public/${slug}/orcamento`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        let detail = `Erro ${res.status}`;
        try {
          const json = await res.json();
          detail = json?.detail ?? detail;
        } catch {}
        throw new Error(detail);
      }

      const data: OrcamentoResponse = await res.json();
      setResultado(data);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao enviar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  /* ── Sucesso ── */
  if (resultado) {
    return (
      <div className="min-h-screen bg-[#050B12] flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-[#2F9285]/15 flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_rgba(47,146,133,0.25)]">
            <CheckCircle size={30} className="text-[#2F9285]" />
          </div>
          <h1 className="text-2xl font-bold text-[#F0EADD] mb-2">
            Orçamento enviado!
          </h1>
          <p className="text-sm text-[#87938F] mb-6 leading-relaxed">
            {resultado.mensagem}
          </p>
          <div className="bg-[#0B171C] border border-[#243337] rounded-[16px] p-5 mb-7">
            <p className="text-xs text-[#87938F] mb-1.5 uppercase tracking-wider">
              Protocolo
            </p>
            <p className="font-mono font-bold text-[#2F9285] text-2xl tracking-widest">
              {resultado.protocolo}
            </p>
            <p className="text-[10px] text-[#87938F]/60 mt-2">
              Guarde este número para acompanhar seu pedido
            </p>
          </div>
          <a
            href={`/${slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-[#2F9285] hover:text-[#3AA99A] transition-colors"
          >
            <ArrowLeft size={14} />
            Voltar ao perfil do estúdio
          </a>
        </div>
      </div>
    );
  }

  /* ── Formulário ── */
  return (
    <div className="min-h-screen bg-[#050B12] px-4 py-10">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="mb-8">
          <a
            href={`/${slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-[#87938F] hover:text-[#F0EADD] transition-colors mb-6"
          >
            <ArrowLeft size={14} />
            Voltar ao perfil
          </a>
          <h1 className="text-2xl font-extrabold text-[#F0EADD]">
            Pedir Orçamento
          </h1>
          <p className="text-sm text-[#87938F] mt-1">
            Estúdio <span className="text-[#2F9285]">@{slug}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── Dados pessoais ── */}
          <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#87938F] uppercase tracking-wider">
              Seus dados
            </h2>

            <div>
              <label className={labelClass}>
                Nome completo <span className="text-[#C36B3F]">*</span>
              </label>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => set("nome", e.target.value)}
                placeholder="Seu nome completo"
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                WhatsApp <span className="text-[#C36B3F]">*</span>
              </label>
              <input
                type="tel"
                value={form.whatsapp}
                onChange={(e) => set("whatsapp", e.target.value)}
                placeholder="(11) 99999-9999"
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                Instagram{" "}
                <span className="text-[#87938F] font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={form.instagram}
                onChange={(e) => set("instagram", e.target.value)}
                placeholder="@seuinstagram"
                className={inputClass}
              />
            </div>
          </div>

          {/* ── Sobre a tatuagem ── */}
          <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#87938F] uppercase tracking-wider">
              Sobre a tatuagem
            </h2>

            <div>
              <label className={labelClass}>
                Descrição da tatuagem <span className="text-[#C36B3F]">*</span>
              </label>
              <textarea
                value={form.descricao}
                onChange={(e) => set("descricao", e.target.value)}
                placeholder="Descreva sua ideia com o máximo de detalhes possível..."
                rows={4}
                required
                className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#050B12] border border-[#243337] text-[#F0EADD] text-sm placeholder-[#87938F]/70 focus:outline-none focus:border-[#2F9285]/60 resize-none transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Estilo</label>
                <div className="relative">
                  <select
                    value={form.estilo}
                    onChange={(e) => set("estilo", e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Selecionar</option>
                    {ESTILOS.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#87938F]">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <label className={labelClass}>Parte do corpo</label>
                <input
                  type="text"
                  value={form.parte_corpo}
                  onChange={(e) => set("parte_corpo", e.target.value)}
                  placeholder="Ex: antebraço"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Tamanho aproximado</label>
              <input
                type="text"
                value={form.tamanho_cm}
                onChange={(e) => set("tamanho_cm", e.target.value)}
                placeholder="Ex: 10 a 15 cm"
                className={inputClass}
              />
            </div>
          </div>

          {/* ── Privacidade ── */}
          <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#87938F] uppercase tracking-wider">
              Privacidade
            </h2>

            <div className="flex items-start gap-2.5 p-3.5 rounded-[12px] bg-[#2F9285]/5 border border-[#2F9285]/15">
              <Shield size={14} className="text-[#2F9285] mt-0.5 shrink-0" />
              <p className="text-xs text-[#87938F] leading-relaxed">
                Seus dados são usados exclusivamente para responder ao seu
                pedido de orçamento e nunca serão compartilhados com terceiros.
              </p>
            </div>

            {[
              {
                key: "aceite_privacidade" as const,
                label: "Li e aceito a Política de Privacidade",
              },
              {
                key: "aceite_termos" as const,
                label: "Li e aceito os Termos de Uso da plataforma SessãoInk",
              },
            ].map(({ key, label }) => (
              <label
                key={key}
                className="flex items-start gap-3 cursor-pointer group"
              >
                <div className="relative mt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={(e) => set(key, e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-4 h-4 rounded-[4px] border border-[#243337] bg-[#050B12] peer-checked:bg-[#2F9285] peer-checked:border-[#2F9285] transition-colors flex items-center justify-center">
                    {form[key] && (
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                        <path
                          d="M1 3.5L3.5 6L8 1"
                          stroke="#050B12"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-sm text-[#87938F] group-hover:text-[#B8C2BF] transition-colors leading-snug">
                  {label}
                </span>
              </label>
            ))}
          </div>

          {/* Erro */}
          {erro && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-[12px] bg-[#C36B3F]/10 border border-[#C36B3F]/25">
              <AlertCircle size={15} className="text-[#C36B3F] mt-0.5 shrink-0" />
              <p className="text-sm text-[#C36B3F]">{erro}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!podeEnviar || enviando}
            className="w-full h-12 rounded-[14px] bg-[#2F9285] hover:bg-[#3AA99A] disabled:opacity-40 disabled:cursor-not-allowed text-[#050B12] font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(47,146,133,0.2)] hover:shadow-[0_0_32px_rgba(47,146,133,0.35)]"
          >
            {enviando ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar pedido de orçamento"
            )}
          </button>

          <p className="text-center text-xs text-[#87938F]/60 pb-4">
            Campos com{" "}
            <span className="text-[#C36B3F]">*</span> são obrigatórios
          </p>
        </form>
      </div>
    </div>
  );
}
