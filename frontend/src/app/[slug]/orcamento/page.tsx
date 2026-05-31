"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  Shield,
  CheckCircle,
  Loader2,
  ArrowLeft,
  AlertCircle,
  Upload,
  X,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

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

interface ImagemReferencia {
  file: File;
  preview: string;
}

const inputClass =
  "w-full h-11 px-3.5 rounded-[14px] bg-[#050B12] border border-[#243337] text-[#F0EADD] text-sm placeholder-[#87938F]/70 focus:outline-none focus:border-[#2F9285]/60 transition-colors";

const selectClass =
  "w-full h-11 px-3.5 rounded-[14px] bg-[#050B12] border border-[#243337] text-[#F0EADD] text-sm focus:outline-none focus:border-[#2F9285]/60 transition-colors appearance-none cursor-pointer";

const labelClass = "block text-sm font-medium text-[#B8C2BF] mb-1.5";

export default function OrcamentoPage() {
  const params = useParams();
  const searchParams = useSearchParams();
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

  useEffect(() => {
    const descParam = searchParams.get("descricao");
    if (descParam) {
      setForm((prev) => ({ ...prev, descricao: descParam }));
    }
  }, [searchParams]);

  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<OrcamentoResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [imagens, setImagens] = useState<ImagemReferencia[]>([]);
  const [emailConfirm, setEmailConfirm] = useState("");
  const [website, setWebsite] = useState("");

  // Limpar previews ao desmontar para evitar memory leaks
  useEffect(() => {
    return () => {
      imagens.forEach((img) => URL.revokeObjectURL(img.preview));
    };
  }, [imagens]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErro(null);
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      
      if (imagens.length + filesArray.length > 5) {
        setErro("Você pode carregar no máximo 5 imagens de referência.");
        return;
      }

      const validFiles: ImagemReferencia[] = [];
      const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
      const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

      for (const file of filesArray) {
        if (!ALLOWED_TYPES.includes(file.type)) {
          setErro("Formato não permitido. Use apenas JPG, PNG ou WEBP.");
          return;
        }
        if (file.size > MAX_SIZE_BYTES) {
          setErro("Cada imagem deve ter no máximo 15MB.");
          return;
        }
        validFiles.push({
          file,
          preview: URL.createObjectURL(file),
        });
      }

      setImagens((prev) => [...prev, ...validFiles]);
    }
  };

  const removerImagem = (index: number) => {
    setImagens((prev) => {
      const target = prev[index];
      if (target) {
        URL.revokeObjectURL(target.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

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
      const formData = new FormData();
      formData.append("nome", form.nome.trim());
      formData.append("whatsapp", form.whatsapp.trim());
      if (form.instagram.trim()) {
        formData.append("instagram", form.instagram.trim());
      }
      if (form.descricao.trim()) {
        formData.append("descricao", form.descricao.trim());
      }
      if (form.estilo) {
        formData.append("estilo", form.estilo);
      }
      if (form.parte_corpo.trim()) {
        formData.append("parte_corpo", form.parte_corpo.trim());
      }
      if (form.tamanho_cm.trim()) {
        formData.append("tamanho_cm", form.tamanho_cm.trim());
      }
      formData.append("aceite_privacidade", String(form.aceite_privacidade));
      formData.append("aceite_termos", String(form.aceite_termos));
      formData.append("email_confirm", emailConfirm);
      formData.append("website", website);

      // Adicionar imagens
      imagens.forEach((img) => {
        formData.append("imagens", img.file);
      });

      const res = await fetch(
        `${API_URL}/api/v1/public/${slug}/orcamento`,
        {
          method: "POST",
          body: formData,
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
          {/* Honeypot fields to prevent spam */}
          <div className="hidden" aria-hidden="true" style={{ display: "none", position: "absolute", left: "-9999px" }}>
            <input
              type="text"
              name="email_confirm"
              value={emailConfirm}
              onChange={(e) => setEmailConfirm(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
            <input
              type="text"
              name="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

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

          {/* ── Fotos de referência ── */}
          <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-semibold text-[#87938F] uppercase tracking-wider">
                Fotos de referência
              </h2>
              <span className="text-xs text-[#87938F]">opcional</span>
            </div>

            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#243337] hover:border-[#2F9285]/50 bg-[#050B12] rounded-[14px] cursor-pointer transition-colors group">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 text-[#87938F] group-hover:text-[#2F9285] transition-colors mb-2" />
                <p className="text-sm text-[#F0EADD] font-medium mb-1">
                  Carregar fotos de referência
                </p>
                <p className="text-xs text-[#87938F]">
                  Selecione uma ou mais imagens
                </p>
              </div>
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>

            {imagens.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mt-4">
                {imagens.map((img, index) => (
                  <div key={index} className="relative aspect-square rounded-[12px] overflow-hidden border border-[#243337] bg-[#050B12]">
                    <img
                      src={img.preview}
                      alt={`Referência ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removerImagem(index)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 hover:bg-black text-[#F0EADD] flex items-center justify-center transition-colors border border-[#243337]/50"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
