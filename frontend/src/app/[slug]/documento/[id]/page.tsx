"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { CheckCircle, Shield, FileText, Loader2, AlertCircle } from "lucide-react";

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
      <div className="min-h-screen bg-[#050B12] flex flex-col items-center justify-center p-6">
        <Loader2 size={32} className="text-[#2F9285] animate-spin mb-4" />
        <p className="text-sm text-[#87938F]">Carregando documento...</p>
      </div>
    );
  }

  if (erro && !documento) {
    return (
      <div className="min-h-screen bg-[#050B12] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-[#0B171C] border border-[#243337] mx-auto mb-5 flex items-center justify-center">
            <AlertCircle size={28} className="text-[#E35D5B]" />
          </div>
          <h1 className="text-xl font-bold text-[#F0EADD] mb-2">Erro ao carregar termo</h1>
          <p className="text-sm text-[#87938F] mb-6">{erro}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050B12] text-[#F0EADD] px-4 py-10 flex flex-col items-center justify-center">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-[#2F9285]/10 border border-[#2F9285]/20 flex items-center justify-center mb-4">
            <FileText size={24} className="text-[#2F9285]" />
          </div>
          <h1 className="text-xl font-bold text-[#F0EADD]">{documento?.titulo}</h1>
          <p className="text-xs text-[#87938F] mt-1">Estúdio: @{slug}</p>
        </div>

        {/* Card do Termo */}
        <div className="bg-[#0B171C] border border-[#243337] rounded-[18px] p-6 shadow-xl mb-6 space-y-4">
          <div className="max-h-60 overflow-y-auto pr-2 text-sm text-[#B8C2BF] leading-relaxed border border-[#243337]/50 rounded-[12px] p-4 bg-[#050B12]/40 font-mono whitespace-pre-wrap">
            {documento?.conteudo || "Sem conteúdo disponível no momento."}
          </div>

          {success ? (
            <div className="p-4 bg-[#54B88D]/10 border border-[#54B88D]/20 text-[#54B88D] rounded-[14px] flex flex-col items-center text-center space-y-2">
              <CheckCircle size={32} className="text-[#54B88D]" />
              <div>
                <p className="font-bold text-sm">Assinado Digitalmente</p>
                <p className="text-xs text-[#87938F] mt-1">
                  Data: {documento?.data_assinatura ? new Date(documento.data_assinatura).toLocaleString("pt-BR") : "-"}
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAssinar} className="space-y-4 pt-2">
              {erro && (
                <div className="p-3 bg-[#E35D5B]/10 border border-[#E35D5B]/25 text-[#E35D5B] text-xs rounded-lg">
                  {erro}
                </div>
              )}

              {/* Nome */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#87938F]">Nome Completo do Assinante *</label>
                <input
                  type="text"
                  required
                  placeholder="Seu nome completo"
                  value={nomeAssinante}
                  onChange={(e) => setNomeAssinante(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-[14px] bg-[#050B12] border border-[#243337] text-sm text-[#F0EADD] placeholder-[#87938F]/60 focus:outline-none focus:border-[#2F9285]/60 transition-colors"
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
                  <div className="w-4.5 h-4.5 rounded-[4px] border border-[#243337] bg-[#050B12] peer-checked:bg-[#2F9285] peer-checked:border-[#2F9285] transition-colors flex items-center justify-center">
                    {aceito && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L4 7L9 1" stroke="#050B12" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-xs text-[#87938F] group-hover:text-[#B8C2BF] transition-colors leading-relaxed">
                  Declaro que li e concordo com os termos expostos no documento acima.
                </span>
              </label>

              {/* Proteção LGPD Alert */}
              <div className="flex items-start gap-2.5 p-3 rounded-[12px] bg-[#2F9285]/5 border border-[#2F9285]/10 text-[11px] text-[#87938F]">
                <Shield size={14} className="text-[#2F9285] shrink-0 mt-0.5" />
                <span>
                  Sua assinatura digital será registrada junto com seu endereço IP e dados de dispositivo para fins de validade jurídica.
                </span>
              </div>

              <button
                type="submit"
                disabled={!nomeAssinante.trim() || !aceito || signing}
                className="w-full h-12 rounded-[14px] bg-[#2F9285] hover:bg-[#3AA99A] disabled:opacity-40 disabled:cursor-not-allowed text-[#050B12] font-bold text-sm transition-all flex items-center justify-center gap-2"
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
