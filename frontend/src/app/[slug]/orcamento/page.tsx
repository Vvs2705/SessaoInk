"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Shield, CheckCircle, Upload, ChevronRight, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api/client";

const STEPS = ["Ideia", "Referências", "Contato", "Privacidade"];

const ESTILOS = ["Realismo","Old School","New School","Blackwork","Fine Line","Aquarela","Geométrico","Tribal","Oriental","Outro"];
const PARTES = ["Braço","Antebraço","Perna","Costela","Costas","Peito","Tornozelo","Pescoço","Mão","Outro"];

export default function OrcamentoPage() {
  const { slug } = useParams();
  const [step, setStep] = useState(0);
  const [enviado, setEnviado] = useState(false);
  const [protocolo, setProtocolo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  const [form, setForm] = useState({
    descricao: "", estilo: "", parte_corpo: "", tamanho: "",
    observacoes: "",
    nome: "", whatsapp: "", instagram: "",
    aceite_privacidade: false, aceite_termos: false,
  });

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  if (enviado) {
    return (
      <div className="min-h-screen bg-[#050B12] flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-[#54B88D]/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-[#54B88D]" />
          </div>
          <h1 className="text-xl font-bold text-[#F0EADD] mb-2">Orçamento enviado!</h1>
          <p className="text-sm text-[#87938F] mb-4">
            Seu pedido foi recebido. O artista entrará em contato em breve.
          </p>
          <div className="bg-[#0B171C] border border-[#243337] rounded-[14px] p-4 mb-6">
            <p className="text-xs text-[#87938F] mb-1">Protocolo</p>
            <p className="font-mono font-bold text-[#2F9285] text-lg">{protocolo}</p>
          </div>
          <a href={`/${slug}`} className="text-sm text-[#2F9285] hover:underline">Voltar ao perfil</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050B12] px-4 py-10">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#F0EADD]">Pedir Orçamento</h1>
          <p className="text-sm text-[#87938F] mt-1">@{slug}</p>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all ${i === step ? "bg-[#2F9285] text-[#050B12]" : i < step ? "bg-[#54B88D]/30 text-[#54B88D]" : "bg-[#102128] text-[#87938F]"}`}>
                {i < step ? "✓" : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`w-8 h-0.5 ${i < step ? "bg-[#54B88D]" : "bg-[#243337]"}`} />}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-6">
          {/* Etapa 1 */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-[#F0EADD] text-lg">Sua ideia</h2>
              <div>
                <label className="block text-sm text-[#B8C2BF] mb-1.5">O que você quer tatuar?</label>
                <textarea
                  value={form.descricao}
                  onChange={(e) => set("descricao", e.target.value)}
                  placeholder="Descreva sua ideia de tatuagem..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#102128] border border-[#243337] text-[#F0EADD] text-sm placeholder-[#87938F] focus:outline-none focus:border-[#2F9285] focus:ring-2 focus:ring-[#2F9285]/20 resize-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[#B8C2BF] mb-1.5">Estilo</label>
                  <select value={form.estilo} onChange={(e) => set("estilo", e.target.value)} className="w-full h-10 px-3 rounded-[14px] bg-[#102128] border border-[#243337] text-[#F0EADD] text-sm focus:outline-none focus:border-[#2F9285] transition-all">
                    <option value="">Selecionar</option>
                    {ESTILOS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[#B8C2BF] mb-1.5">Parte do corpo</label>
                  <select value={form.parte_corpo} onChange={(e) => set("parte_corpo", e.target.value)} className="w-full h-10 px-3 rounded-[14px] bg-[#102128] border border-[#243337] text-[#F0EADD] text-sm focus:outline-none focus:border-[#2F9285] transition-all">
                    <option value="">Selecionar</option>
                    {PARTES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-[#B8C2BF] mb-1.5">Tamanho aproximado</label>
                <input value={form.tamanho} onChange={(e) => set("tamanho", e.target.value)} placeholder="Ex: 10cm x 8cm" className="w-full h-10 px-3.5 rounded-[14px] bg-[#102128] border border-[#243337] text-[#F0EADD] text-sm placeholder-[#87938F] focus:outline-none focus:border-[#2F9285] transition-all" />
              </div>
            </div>
          )}

          {/* Etapa 2 */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-[#F0EADD] text-lg">Referências (opcional)</h2>
              <div className="border-2 border-dashed border-[#243337] rounded-[14px] p-8 text-center">
                <Upload size={28} className="text-[#87938F] mx-auto mb-2" />
                <p className="text-sm text-[#87938F]">Arraste imagens ou clique para selecionar</p>
                <p className="text-xs text-[#87938F]/60 mt-1">Máx. 5 fotos · 10MB cada</p>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-[10px] bg-[#2F9285]/5 border border-[#2F9285]/20">
                <Shield size={14} className="text-[#2F9285] mt-0.5 shrink-0" />
                <p className="text-xs text-[#87938F]">
                  Suas imagens são <strong className="text-[#F0EADD]">completamente privadas</strong> e nunca serão publicadas sem sua autorização explícita.
                </p>
              </div>
              <div>
                <label className="block text-sm text-[#B8C2BF] mb-1.5">Observações adicionais</label>
                <textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} placeholder="Algum detalhe especial que queira mencionar..." rows={3} className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#102128] border border-[#243337] text-[#F0EADD] text-sm placeholder-[#87938F] focus:outline-none focus:border-[#2F9285] focus:ring-2 focus:ring-[#2F9285]/20 resize-none transition-all" />
              </div>
            </div>
          )}

          {/* Etapa 3 */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-[#F0EADD] text-lg">Seus dados de contato</h2>
              <div>
                <label className="block text-sm text-[#B8C2BF] mb-1.5">Nome completo</label>
                <input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Seu nome" className="w-full h-10 px-3.5 rounded-[14px] bg-[#102128] border border-[#243337] text-[#F0EADD] text-sm placeholder-[#87938F] focus:outline-none focus:border-[#2F9285] transition-all" />
              </div>
              <div>
                <label className="block text-sm text-[#B8C2BF] mb-1.5">WhatsApp</label>
                <input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(11) 99999-9999" type="tel" className="w-full h-10 px-3.5 rounded-[14px] bg-[#102128] border border-[#243337] text-[#F0EADD] text-sm placeholder-[#87938F] focus:outline-none focus:border-[#2F9285] transition-all" />
              </div>
              <div>
                <label className="block text-sm text-[#B8C2BF] mb-1.5">Instagram <span className="text-[#87938F]">(opcional)</span></label>
                <input value={form.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@seuinstagram" className="w-full h-10 px-3.5 rounded-[14px] bg-[#102128] border border-[#243337] text-[#F0EADD] text-sm placeholder-[#87938F] focus:outline-none focus:border-[#2F9285] transition-all" />
              </div>
            </div>
          )}

          {/* Etapa 4 */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-[#F0EADD] text-lg">Privacidade e confirmação</h2>
              <div className="space-y-3">
                {[
                  { key: "aceite_privacidade", label: "Li e aceito a Política de Privacidade. Entendo como meus dados serão usados." },
                  { key: "aceite_termos", label: "Li e aceito os Termos de Uso da plataforma SessãoInk." },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form[key as keyof typeof form] as boolean}
                      onChange={(e) => set(key, e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#2F9285] shrink-0"
                    />
                    <span className="text-sm text-[#87938F]">{label}</span>
                  </label>
                ))}
              </div>
              <div className="p-4 rounded-[14px] bg-[#2F9285]/5 border border-[#2F9285]/20">
                <p className="text-xs text-[#87938F] leading-relaxed">
                  Seus dados serão usados exclusivamente para responder ao seu pedido de orçamento. Você pode solicitar exclusão a qualquer momento pelo e-mail do estúdio.
                </p>
              </div>
            </div>
          )}

          {/* Botões de navegação */}
          <div className="flex gap-3 mt-6">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} className="flex-1 h-11 rounded-[14px] border border-[#243337] text-[#87938F] hover:text-[#F0EADD] hover:bg-[#102128] text-sm font-medium transition-all">
                Voltar
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                className="flex-1 h-11 rounded-[14px] bg-[#2F9285] hover:bg-[#3AA99A] text-[#050B12] font-semibold text-sm transition-all flex items-center justify-center gap-2"
              >
                Próximo
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                disabled={!form.aceite_privacidade || !form.aceite_termos || enviando}
                onClick={async () => {
                  setEnviando(true);
                  setErroEnvio(null);
                  try {
                    const res = await api.post<{ protocolo: string }>(`/api/v1/public/${slug}/orcamento`, {
                      nome: form.nome,
                      whatsapp: form.whatsapp,
                      instagram: form.instagram || undefined,
                      descricao: form.descricao || undefined,
                      estilo: form.estilo || undefined,
                      parte_corpo: form.parte_corpo || undefined,
                      aceite_privacidade: true,
                      aceite_termos: true,
                    });
                    setProtocolo(res.protocolo);
                    setEnviado(true);
                  } catch (e) {
                    setErroEnvio(e instanceof ApiError ? e.detail : "Erro ao enviar. Tente novamente.");
                  } finally {
                    setEnviando(false);
                  }
                }}
                className="flex-1 h-11 rounded-[14px] bg-[#2F9285] hover:bg-[#3AA99A] disabled:opacity-50 disabled:cursor-not-allowed text-[#050B12] font-semibold text-sm transition-all flex items-center justify-center gap-2"
              >
                {enviando ? <><Loader2 size={16} className="animate-spin" />Enviando...</> : "Confirmar e Enviar"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
