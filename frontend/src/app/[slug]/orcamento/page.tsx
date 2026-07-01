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
  ChevronRight,
} from "lucide-react";
import { captureAppEvent } from "@/lib/posthog";
import { cn } from "@/lib/utils";

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
  email: string;
  instagram: string;
  descricao: string;
  estilo: string;
  parte_corpo: string;
  tamanho_cm: string;
  horario_personalizado: string;
  aceite_privacidade: boolean;
  aceite_termos: boolean;
}

interface DisponibilidadeDia {
  data: string;
  sessoes: number;
}

interface DisponibilidadeResponse {
  horario_funcionamento: Record<string, { abre: string; fecha: string }> | null;
  dias_ocupados: DisponibilidadeDia[];
  janela_dias: number;
}

interface DataPreferida {
  data: string; // YYYY-MM-DD
  periodo: "manha" | "tarde" | "noite";
}

const PERIODOS: { value: DataPreferida["periodo"]; label: string }[] = [
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
  { value: "noite", label: "Noite" },
];

const DIAS_SEMANA_CURTO = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

/** Converte Date.getDay() (0=dom) para o índice do backend (0=seg…6=dom). */
function diaBackend(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function isoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

interface ImagemReferencia {
  file: File;
  preview: string;
}

const inputClass =
  "w-full h-11 px-3.5 rounded-[14px] bg-ink-night border border-mist-line text-porcelain-ink text-sm placeholder-text-subtle/70 focus:outline-none focus:border-teal-ink/60 transition-colors";

const selectClass =
  "w-full h-11 px-3.5 rounded-[14px] bg-ink-night border border-mist-line text-porcelain-ink text-sm focus:outline-none focus:border-teal-ink/60 transition-colors appearance-none cursor-pointer";

const labelClass = "block text-sm font-medium text-smoke-text mb-1.5";

export default function OrcamentoPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug ?? "";

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>({
    nome: "",
    whatsapp: "",
    email: "",
    instagram: "",
    descricao: "",
    estilo: "",
    parte_corpo: "",
    tamanho_cm: "",
    horario_personalizado: "",
    aceite_privacidade: false,
    aceite_termos: false,
  });

  // Etapa de agenda: disponibilidade do estúdio + datas escolhidas pelo cliente
  const [disponibilidade, setDisponibilidade] =
    useState<DisponibilidadeResponse | null>(null);
  const [datasPreferidas, setDatasPreferidas] = useState<DataPreferida[]>([]);
  const [mostrarHorarioCustom, setMostrarHorarioCustom] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`${API_URL}/api/v1/public/${slug}/disponibilidade`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: DisponibilidadeResponse | null) => setDisponibilidade(data))
      .catch(() => setDisponibilidade(null));
  }, [slug]);

  const sessoesPorDia = new Map(
    (disponibilidade?.dias_ocupados ?? []).map((d) => [d.data, d.sessoes])
  );

  const horario = disponibilidade?.horario_funcionamento ?? null;

  // Próximos 21 dias para o cliente sugerir preferências
  const diasSugeriveis: Date[] = Array.from({ length: 21 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + 1 + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const diaAberto = (d: Date) =>
    !horario || Boolean(horario[String(diaBackend(d))]);

  const togglePreferencia = (dataIso: string, periodo: DataPreferida["periodo"]) => {
    setErro(null);
    setDatasPreferidas((prev) => {
      const existente = prev.find((p) => p.data === dataIso);
      if (existente?.periodo === periodo) {
        return prev.filter((p) => p.data !== dataIso);
      }
      if (existente) {
        return prev.map((p) => (p.data === dataIso ? { ...p, periodo } : p));
      }
      if (prev.length >= 3) {
        setErro("Você pode sugerir no máximo 3 datas.");
        return prev;
      }
      return [...prev, { data: dataIso, periodo }];
    });
  };

  // Flash art selecionada (cliente clicou numa flash no portal)
  const [flashId, setFlashId] = useState<string | null>(null);
  const [flashTitulo, setFlashTitulo] = useState<string | null>(null);

  useEffect(() => {
    const flashParam = searchParams.get("flash");
    const tituloParam = searchParams.get("titulo");
    const descParam = searchParams.get("descricao");

    if (flashParam && tituloParam) {
      // Fluxo de flash art: identifica a arte e já preenche a descrição.
      setFlashId(flashParam);
      setFlashTitulo(tituloParam);
      setForm((prev) => ({
        ...prev,
        descricao:
          prev.descricao ||
          `Olá! Tenho interesse em fazer a flash art "${tituloParam}".`,
      }));
    } else if (descParam) {
      setForm((prev) => ({ ...prev, descricao: descParam }));
      setStep(2); // Descrição veio do portfólio
    }
  }, [searchParams]);

  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<OrcamentoResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [imagens, setImagens] = useState<ImagemReferencia[]>([]);
  const [emailConfirm, setEmailConfirm] = useState("");
  const [website, setWebsite] = useState("");

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

  // Step Validation
  const canGoToStep2 = form.nome.trim().length >= 2 && form.whatsapp.trim().length >= 8;
  const canGoToStep3 = form.descricao.trim().length >= 10;
  const canSubmit = form.aceite_privacidade && form.aceite_termos;
  const TOTAL_STEPS = 5;

  const nextStep = () => {
    setErro(null);
    if (step === 1 && !canGoToStep2) {
      setErro("Preencha seu nome e um WhatsApp válido.");
      return;
    }
    if (step === 2 && !canGoToStep3) {
      setErro("Descreva sua ideia com um pouco mais de detalhes (mínimo 10 caracteres).");
      return;
    }
    setStep((s) => s + 1);
  };

  const prevStep = () => {
    setErro(null);
    setStep((s) => s - 1);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      setErro("É necessário aceitar os termos de uso e privacidade.");
      return;
    }

    setEnviando(true);
    setErro(null);

    try {
      const formData = new FormData();
      formData.append("nome", form.nome.trim());
      formData.append("whatsapp", form.whatsapp.trim());
      if (form.instagram.trim()) {
        formData.append("instagram", form.instagram.trim());
      }
      // Garante que o estúdio identifique a flash art, mesmo se o cliente editar a descrição.
      let descricaoFinal = form.descricao.trim();
      if (flashTitulo && !descricaoFinal.toLowerCase().includes(flashTitulo.toLowerCase())) {
        descricaoFinal = `[Flash art: ${flashTitulo}] ${descricaoFinal}`.trim();
      }
      if (descricaoFinal) {
        formData.append("descricao", descricaoFinal);
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
      if (form.email.trim()) {
        formData.append("email", form.email.trim());
      }
      if (datasPreferidas.length > 0) {
        formData.append("datas_preferidas", JSON.stringify(datasPreferidas));
      }
      if (form.horario_personalizado.trim()) {
        formData.append("horario_personalizado", form.horario_personalizado.trim());
      }
      formData.append("aceite_privacidade", String(form.aceite_privacidade));
      formData.append("aceite_termos", String(form.aceite_termos));
      formData.append("email_confirm", emailConfirm);
      formData.append("website", website);

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
      captureAppEvent("orcamento_publico_enviado", {
        slug,
        imagens: imagens.length,
      });
      setResultado(data);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao enviar orçamento.");
    } finally {
      setEnviando(false);
    }
  }

  if (resultado) {
    return (
      <div className="min-h-screen bg-ink-night flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-teal-ink/15 flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_rgba(47,146,133,0.25)]">
            <CheckCircle size={30} className="text-teal-ink" />
          </div>
          <h1 className="text-2xl font-bold text-porcelain-ink mb-2">Orçamento enviado!</h1>
          <p className="text-sm text-text-subtle mb-6 leading-relaxed">{resultado.mensagem}</p>
          <div className="bg-ink-bg border border-mist-line rounded-[16px] p-5 mb-7">
            <p className="text-xs text-text-subtle mb-1.5 uppercase tracking-wider">Protocolo</p>
            <p className="font-mono font-bold text-teal-ink text-2xl tracking-widest">{resultado.protocolo}</p>
            <p className="text-[10px] text-text-subtle/60 mt-2">Guarde este número para acompanhar seu pedido</p>
          </div>
          <a
            href={`/${slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-teal-ink hover:text-ink-gold transition-colors"
          >
            <ArrowLeft size={14} /> Voltar ao perfil do estúdio
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-night px-4 py-10">
      <div className="max-w-lg mx-auto">
        
        {/* Header */}
        <div className="mb-6">
          <a
            href={`/${slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-text-subtle hover:text-porcelain-ink transition-colors mb-4"
          >
            <ArrowLeft size={14} /> Voltar ao perfil
          </a>
          <h1 className="text-2xl font-extrabold text-porcelain-ink">
            {flashTitulo ? "Solicitar esta Flash Art" : "Solicitar Orçamento"}
          </h1>
          <p className="text-sm text-text-subtle mt-1">
            Estúdio <span className="text-teal-ink">@{slug}</span>
          </p>
        </div>

        {/* Banner da flash art selecionada */}
        {flashTitulo && (
          <div className="flex items-center gap-3 mb-6 p-3 rounded-[16px] bg-copper-needle/10 border border-copper-needle/25">
            {flashId && (
              <img
                src={`/api/v1/public/${slug}/flash-arts/${flashId}/imagem`}
                alt={flashTitulo}
                className="w-16 h-16 rounded-[12px] object-cover border border-mist-line shrink-0"
              />
            )}
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-copper-needle font-semibold">
                Flash art selecionada
              </p>
              <p className="text-sm font-semibold text-porcelain-ink truncate">{flashTitulo}</p>
              <p className="text-xs text-text-subtle">
                É só preencher seus dados — o estúdio já saberá qual arte você quer.
              </p>
            </div>
          </div>
        )}

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8 bg-ink-bg border border-mist-line p-3 rounded-[16px]">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex-1 flex items-center gap-1.5">
              <div
                className={cn(
                  "w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-colors shrink-0",
                  step >= s
                    ? "bg-teal-ink text-ink-night"
                    : "bg-ink-night border border-mist-line text-text-subtle"
                )}
              >
                {s}
              </div>
              <div
                className={cn(
                  "h-1 rounded transition-colors flex-1 hidden sm:block",
                  step > s ? "bg-teal-ink" : "bg-mist-line"
                )}
              />
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Honeypot */}
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

          {/* PASSO 1: Identificação */}
          {step === 1 && (
            <div className="bg-ink-bg border border-mist-line rounded-[18px] p-5 space-y-4">
              <h2 className="text-sm font-semibold text-text-subtle uppercase tracking-wider">Identificação</h2>
              <div>
                <label className={labelClass}>Nome completo <span className="text-copper-needle">*</span></label>
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
                <label className={labelClass}>WhatsApp <span className="text-copper-needle">*</span></label>
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
                <label className={labelClass}>E-mail <span className="text-text-subtle font-normal">(opcional)</span></label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="voce@email.com"
                  autoComplete="email"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Instagram <span className="text-text-subtle font-normal">(opcional)</span></label>
                <input
                  type="text"
                  value={form.instagram}
                  onChange={(e) => set("instagram", e.target.value)}
                  placeholder="@seuinstagram"
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* PASSO 2: A Tattoo */}
          {step === 2 && (
            <div className="bg-ink-bg border border-mist-line rounded-[18px] p-5 space-y-4">
              <h2 className="text-sm font-semibold text-text-subtle uppercase tracking-wider">A Tattoo</h2>
              <div>
                <label className={labelClass}>Descrição da ideia <span className="text-copper-needle">*</span></label>
                <textarea
                  value={form.descricao}
                  onChange={(e) => set("descricao", e.target.value)}
                  placeholder="Descreva o que quer tatuar, tamanho aproximado, referências..."
                  rows={4}
                  required
                  className="w-full px-3.5 py-2.5 rounded-[14px] bg-ink-night border border-mist-line text-porcelain-ink text-sm placeholder-text-subtle/70 focus:outline-none focus:border-teal-ink/60 resize-none transition-colors"
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
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Local do corpo</label>
                  <input
                    type="text"
                    value={form.parte_corpo}
                    onChange={(e) => set("parte_corpo", e.target.value)}
                    placeholder="Ex: braço"
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Tamanho aproximado (cm)</label>
                <input
                  type="text"
                  value={form.tamanho_cm}
                  onChange={(e) => set("tamanho_cm", e.target.value)}
                  placeholder="Ex: 15cm"
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* PASSO 3: Fotos de Referência */}
          {step === 3 && (
            <div className="bg-ink-bg border border-mist-line rounded-[18px] p-5 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-semibold text-text-subtle uppercase tracking-wider">Fotos de referência</h2>
                <span className="text-xs text-text-subtle">opcional</span>
              </div>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-mist-line hover:border-teal-ink/50 bg-ink-night rounded-[14px] cursor-pointer transition-colors group">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 text-text-subtle group-hover:text-teal-ink transition-colors mb-2" />
                  <p className="text-sm text-porcelain-ink font-medium mb-1">Carregar referências</p>
                  <p className="text-xs text-text-subtle">Envie até 5 imagens (JPG, PNG, WEBP)</p>
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
                    <div key={index} className="relative aspect-square rounded-[12px] overflow-hidden border border-mist-line">
                      <img src={img.preview} alt="preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removerImagem(index)}
                        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/80 hover:bg-black text-white flex items-center justify-center"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PASSO 4: Datas de preferência */}
          {step === 4 && (
            <div className="bg-ink-bg border border-mist-line rounded-[18px] p-5 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-semibold text-text-subtle uppercase tracking-wider">Quando você pode?</h2>
                <span className="text-xs text-text-subtle">opcional · até 3 datas</span>
              </div>
              <p className="text-xs text-text-subtle leading-relaxed">
                Sugira datas e períodos em que você tem disponibilidade — isso agiliza
                o agendamento com o estúdio. Dias fora do horário de funcionamento
                aparecem desabilitados.
              </p>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {diasSugeriveis.map((d) => {
                  const iso = isoLocal(d);
                  const aberto = diaAberto(d);
                  const selecionada = datasPreferidas.find((p) => p.data === iso);
                  const ocupacao = sessoesPorDia.get(iso) ?? 0;
                  return (
                    <div
                      key={iso}
                      className={cn(
                        "rounded-[12px] border p-2 text-center transition-colors",
                        !aberto
                          ? "border-mist-line/50 bg-ink-night/50 opacity-40"
                          : selecionada
                            ? "border-teal-ink bg-teal-ink/10"
                            : "border-mist-line bg-ink-night"
                      )}
                    >
                      <p className="text-[10px] uppercase tracking-wider text-text-subtle">
                        {DIAS_SEMANA_CURTO[diaBackend(d)]}
                      </p>
                      <p className="text-sm font-bold text-porcelain-ink">
                        {d.getDate()}/{d.getMonth() + 1}
                      </p>
                      {ocupacao > 0 && aberto && (
                        <p className="text-[9px] text-copper-needle mt-0.5">
                          {ocupacao} {ocupacao === 1 ? "sessão" : "sessões"}
                        </p>
                      )}
                      {aberto ? (
                        <div className="flex flex-col gap-1 mt-1.5">
                          {PERIODOS.map((p) => (
                            <button
                              key={p.value}
                              type="button"
                              onClick={() => togglePreferencia(iso, p.value)}
                              className={cn(
                                "text-[10px] font-semibold rounded-[8px] py-1 min-h-[28px] transition-colors",
                                selecionada?.periodo === p.value
                                  ? "bg-teal-ink text-ink-night"
                                  : "bg-ink-bg border border-mist-line text-text-subtle hover:text-porcelain-ink hover:border-teal-ink/50"
                              )}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[9px] text-text-subtle mt-1.5">fechado</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {datasPreferidas.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {datasPreferidas.map((p) => {
                    const [, m, dia] = p.data.split("-");
                    const label = PERIODOS.find((x) => x.value === p.periodo)?.label;
                    return (
                      <span
                        key={p.data}
                        className="inline-flex items-center gap-1.5 text-xs text-teal-ink bg-teal-ink/10 border border-teal-ink/25 rounded-full px-3 py-1.5"
                      >
                        {dia}/{m} · {label}
                        <button
                          type="button"
                          onClick={() =>
                            setDatasPreferidas((prev) =>
                              prev.filter((x) => x.data !== p.data)
                            )
                          }
                          aria-label="Remover data"
                          className="hover:text-porcelain-ink"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="border-t border-mist-line pt-3">
                <button
                  type="button"
                  onClick={() => setMostrarHorarioCustom((v) => !v)}
                  className="text-xs font-semibold text-copper-needle hover:text-[#D87E52] transition-colors min-h-[44px] text-left"
                >
                  {mostrarHorarioCustom
                    ? "Esconder horário personalizado"
                    : "Precisa de um horário fora do funcionamento padrão?"}
                </button>
                {mostrarHorarioCustom && (
                  <textarea
                    value={form.horario_personalizado}
                    onChange={(e) => set("horario_personalizado", e.target.value)}
                    placeholder="Ex: só consigo após as 20h, ou aos domingos de manhã..."
                    rows={2}
                    maxLength={300}
                    className="mt-2 w-full px-3.5 py-2.5 rounded-[14px] bg-ink-night border border-mist-line text-porcelain-ink text-sm placeholder-text-subtle/70 focus:outline-none focus:border-teal-ink/60 resize-none transition-colors"
                  />
                )}
              </div>
            </div>
          )}

          {/* PASSO 5: Envio & Privacidade */}
          {step === 5 && (
            <div className="bg-ink-bg border border-mist-line rounded-[18px] p-5 space-y-4">
              <h2 className="text-sm font-semibold text-text-subtle uppercase tracking-wider">Termos & Envio</h2>
              <div className="flex items-start gap-2.5 p-3.5 rounded-[12px] bg-teal-ink/5 border border-teal-ink/15">
                <Shield size={14} className="text-teal-ink mt-0.5 shrink-0" />
                <p className="text-xs text-text-subtle leading-relaxed">
                  Seus dados são protegidos e serão utilizados exclusivamente para retornar o contato sobre o seu pedido.
                </p>
              </div>

              {[
                {
                  key: "aceite_privacidade" as const,
                  label: "Li e aceito a Política de Privacidade do estúdio",
                },
                {
                  key: "aceite_termos" as const,
                  label: "Li e aceito os Termos de Uso da plataforma SessãoInk",
                },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={(e) => set(key, e.target.checked)}
                    className="mt-1"
                  />
                  <span className="text-sm text-text-subtle group-hover:text-smoke-text transition-colors">{label}</span>
                </label>
              ))}
            </div>
          )}

          {erro && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-[12px] bg-copper-needle/10 border border-copper-needle/25">
              <AlertCircle size={15} className="text-copper-needle mt-0.5 shrink-0" />
              <p className="text-sm text-copper-needle">{erro}</p>
            </div>
          )}

          {/* Ações do formulário */}
          <div className="flex gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className="flex-1 h-12 rounded-[14px] border border-mist-line bg-ink-night hover:bg-surface-raised text-text-subtle hover:text-porcelain-ink text-sm font-semibold transition-all"
              >
                Voltar
              </button>
            )}
            
            {step < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={nextStep}
                className="flex-1 h-12 rounded-[14px] bg-teal-ink hover:bg-ink-gold text-ink-night text-sm font-bold transition-all flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(47,146,133,0.15)]"
              >
                Avançar <ChevronRight size={15} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSubmit || enviando}
                className="flex-1 h-12 rounded-[14px] bg-teal-ink hover:bg-ink-gold disabled:opacity-40 text-ink-night font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(47,146,133,0.25)]"
              >
                {enviando ? (
                  <><Loader2 size={16} className="animate-spin" /> Enviando...</>
                ) : (
                  "Enviar Pedido"
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
