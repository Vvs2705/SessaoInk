"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { CheckCircle, Shield, FileText, Loader2, AlertCircle } from "lucide-react";
import { captureAppEvent } from "@/lib/posthog";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

interface DocumentoPublico {
  id: string;
  tipo: string;
  titulo: string;
  conteudo: string | null;
  assinado: boolean;
  data_assinatura: string | null;
}

export default function DocumentoAssinaturaPage() {
  const params = useParams();
  const docId = params.id as string;
  const slug = params.slug as string;

  const [documento, setDocumento] = useState<DocumentoPublico | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form states
  const [nomeAssinante, setNomeAssinante] = useState("");
  const [aceito, setAceito] = useState(false);

  useEffect(() => {
    async function carregarDocumento() {
      try {
        const res = await fetch(`${API_URL}/api/v1/public/documentos/${docId}`);
        if (!res.ok) {
          throw new Error("Não foi possível carregar o documento.");
        }
        const data = await res.json();
        setDocumento(data);
        if (data.assinado) {
          setSuccess(true);
        }
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro ao carregar o termo.");
      } finally {
        setLoading(false);
      }
    }
    carregarDocumento();
  }, [docId]);

  const handleAssinar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeAssinante.trim() || !aceito) return;

    setSigning(true);
    setErro(null);

    try {
      // Obter IP do assinante de forma simples
      let ip = "127.0.0.1";
      try {
        const ipRes = await fetch("https://api.ipify.org?format=json");
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          ip = ipData.ip;
        }
      } catch {}

      const userAgent = navigator.userAgent;

      const res = await fetch(`${API_URL}/api/v1/public/documentos/${docId}/assinar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ip,
          user_agent: userAgent,
          nome_assinante: nomeAssinante.trim(),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson?.detail ?? "Falha ao assinar documento.");
      }

      captureAppEvent("documento_publico_assinado", {
        tipo: documento?.tipo,
      });
      setSuccess(true);
      if (documento) {
        setDocumento({
          ...documento,
          assinado: true,
          data_assinatura: new Date().toISOString(),
        });
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Ocorreu um erro ao assinar.");
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ink-night flex flex-col items-center justify-center p-6">
        <Loader2 size={32} className="text-teal-ink animate-spin mb-4" />
        <p className="text-sm text-text-subtle">Carregando documento...</p>
      </div>
    );
  }

  if (erro && !documento) {
    return (
      <div className="min-h-screen bg-ink-night flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-lg bg-ink-bg border border-mist-line mx-auto mb-5 flex items-center justify-center">
            <AlertCircle size={28} className="text-error-red" />
          </div>
          <h1 className="text-xl font-bold text-porcelain-ink mb-2">Erro ao carregar termo</h1>
          <p className="text-sm text-text-subtle mb-6">{erro}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-night text-porcelain-ink px-4 py-10 flex flex-col items-center justify-center">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-14 h-14 rounded-lg bg-teal-ink/10 border border-teal-ink/20 flex items-center justify-center mb-4">
            <FileText size={24} className="text-teal-ink" />
          </div>
          <h1 className="text-xl font-bold text-porcelain-ink">{documento?.titulo}</h1>
          <p className="text-xs text-text-subtle mt-1">Estúdio: @{slug}</p>
        </div>

        {/* Card do Termo */}
        <div className="bg-ink-bg border border-mist-line rounded-[18px] p-6 shadow-ink-lg mb-6 space-y-4">
          <div className="max-h-60 overflow-y-auto pr-2 text-sm text-smoke-text leading-relaxed border border-mist-line/50 rounded-[12px] p-4 bg-ink-night/40 font-mono whitespace-pre-wrap">
            {documento?.conteudo || "Sem conteúdo disponível no momento."}
          </div>

          {success ? (
            <div className="p-4 bg-success/10 border border-success/20 text-success rounded-[14px] flex flex-col items-center text-center space-y-2">
              <CheckCircle size={32} className="text-success" />
              <div>
                <p className="font-bold text-sm">Assinado Digitalmente</p>
                <p className="text-xs text-text-subtle mt-1">
                  Data: {documento?.data_assinatura ? new Date(documento.data_assinatura).toLocaleString("pt-BR") : "-"}
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAssinar} className="space-y-4 pt-2">
              {erro && (
                <div className="p-3 bg-error-red/10 border border-error-red/25 text-error-red text-xs rounded-lg">
                  {erro}
                </div>
              )}

              {/* Nome */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-text-subtle">Nome Completo do Assinante *</label>
                <input
                  type="text"
                  required
                  placeholder="Seu nome completo"
                  value={nomeAssinante}
                  onChange={(e) => setNomeAssinante(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-[14px] bg-ink-night border border-mist-line text-sm text-porcelain-ink placeholder-text-subtle/60 focus:outline-none focus:border-teal-ink/60 transition-colors"
                />
              </div>

              {/* Declaração de Aceite */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    checked={aceito}
                    onChange={(e) => setAceito(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-4.5 h-4.5 rounded-[4px] border border-mist-line bg-ink-night peer-checked:bg-teal-ink peer-checked:border-teal-ink transition-colors flex items-center justify-center">
                    {aceito && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L4 7L9 1" stroke="#050B12" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-xs text-text-subtle group-hover:text-smoke-text transition-colors leading-relaxed">
                  Declaro que li e concordo com os termos expostos no documento acima.
                </span>
              </label>

              {/* Proteção LGPD Alert */}
              <div className="flex items-start gap-2.5 p-3 rounded-[12px] bg-teal-ink/5 border border-teal-ink/10 text-[11px] text-text-subtle">
                <Shield size={14} className="text-teal-ink shrink-0 mt-0.5" />
                <span>
                  Sua assinatura digital será registrada junto com seu endereço IP e dados de dispositivo para fins de validade jurídica.
                </span>
              </div>

              <button
                type="submit"
                disabled={!nomeAssinante.trim() || !aceito || signing}
                className="w-full h-12 rounded-[14px] bg-teal-ink hover:bg-ink-gold disabled:opacity-40 disabled:cursor-not-allowed text-ink-night font-bold text-sm transition-all flex items-center justify-center gap-2"
              >
                {signing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Assinando...
                  </>
                ) : (
                  "Assinar Documento"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
