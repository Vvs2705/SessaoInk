"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, Upload, Eye, EyeOff, Loader2, X, ShieldCheck, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

interface PortfolioItem {
  id: string;
  imagem_path: string;
  titulo: string | null;
  estilo: string | null;
  parte_corpo: string | null;
  visibilidade: "PRIVADO" | "PUBLICO";
  autorizado_publicacao: boolean;
}

export default function PortfolioPage() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [erroUpload, setErroUpload] = useState<string | null>(null);

  // Modal de confirmação de autorização de publicação
  const [pubItem, setPubItem] = useState<PortfolioItem | null>(null);
  const [pubLoading, setPubLoading] = useState(false);
  const [pubError, setPubError] = useState<string | null>(null);

  const visMutation = useMutation({
    mutationFn: ({ id, visibilidade, autorizado }: { id: string; visibilidade: string; autorizado: boolean }) =>
      api.patch(`/api/v1/portfolio/${id}/visibilidade?visibilidade=${visibilidade}&autorizado=${autorizado}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio"] });
      setPubItem(null);
    },
    onError: (err: any) => {
      setPubError(err.message ?? "Erro ao alterar visibilidade.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/portfolio/${id}/visibilidade?visibilidade=PRIVADO&autorizado=false`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio"] }),
  });

  const { data = [], isLoading } = useQuery<PortfolioItem[]>({
    queryKey: ["portfolio"],
    queryFn: () => api.get("/api/v1/portfolio/"),
  });

  const handleUpload = async (file: File) => {
    setErroUpload(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErroUpload("Apenas JPG, PNG ou WebP são permitidos.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setErroUpload("Arquivo muito grande (máx 15MB).");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("arquivo", file);
      await fetch(`${API}/api/v1/portfolio/upload`, {
        method: "POST",
        credentials: "include",
        body: form,
      }).then(async r => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({ detail: "Erro no upload" }));
          throw new Error(err.detail);
        }
        return r.json();
      });
      qc.invalidateQueries({ queryKey: ["portfolio"] });
    } catch (e: any) {
      setErroUpload(e.message ?? "Erro ao fazer upload.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EADD]">Portfólio</h1>
          <p className="text-sm text-[#87938F] mt-1">
            {isLoading ? "Carregando..." : `${data.length} foto${data.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 h-10 px-4 rounded-[14px] bg-[#2F9285] hover:bg-[#3AA99A] disabled:opacity-60 text-[#050B12] font-semibold text-sm transition-all shrink-0"
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {uploading ? "Enviando..." : "Adicionar Foto"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
        />
      </div>

      {/* Legenda */}
      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-1.5 text-xs text-[#87938F]"><Eye size={14} className="text-[#2F9285]" /> Público</div>
        <div className="flex items-center gap-1.5 text-xs text-[#87938F]"><EyeOff size={14} className="text-[#87938F]" /> Privado (padrão)</div>
      </div>

      {/* Erro upload */}
      {erroUpload && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-[10px] bg-[#E35D5B]/10 border border-[#E35D5B]/30 text-sm text-[#E35D5B]">
          {erroUpload}
          <button onClick={() => setErroUpload(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Aviso de privacidade */}
      <div className="flex items-start gap-2 p-3 mb-6 rounded-[10px] bg-[#2F9285]/5 border border-[#2F9285]/20 text-xs text-[#87938F]">
        <EyeOff size={14} className="text-[#87938F] mt-0.5 shrink-0" />
        Todas as fotos são <strong className="text-[#F0EADD] mx-1">privadas por padrão</strong>. Para publicar no portal, é necessário confirmar a autorização do cliente.
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="aspect-square bg-[#0B171C] rounded-[14px] animate-pulse" />)}
        </div>
      )}

      {!isLoading && data.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-[#0B171C] border border-[#243337] rounded-[18px]">
          <ImageIcon size={48} className="text-[#243337] mb-4" />
          <h3 className="text-[#F0EADD] font-semibold mb-2">Nenhuma foto ainda</h3>
          <p className="text-sm text-[#87938F] max-w-sm mb-6">
            Adicione fotos das suas tatuagens. Todas serão privadas até você publicar.
          </p>
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 h-10 px-5 rounded-[14px] bg-[#2F9285] hover:bg-[#3AA99A] text-[#050B12] font-semibold text-sm"
          >
            <Upload size={16} />
            Fazer Upload
          </button>
        </div>
      )}

      {!isLoading && data.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {data.map(item => (
            <div
              key={item.id}
              className="relative aspect-square bg-[#0B171C] border border-[#243337] rounded-[14px] overflow-hidden group hover:border-[#2F9285]/40 transition-all"
            >
              <img
                src={`${API}/api/v1/portfolio/${item.id}/imagem`}
                alt={item.titulo ?? "Foto portfólio"}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#050B12]/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                {item.titulo && <p className="text-xs font-semibold text-[#F0EADD] truncate">{item.titulo}</p>}
                {item.estilo && <p className="text-[10px] text-[#87938F]">{item.estilo}</p>}
              </div>
              {/* Badge visibilidade — clicável */}
              <button
                onClick={() => {
                  if (item.visibilidade === "PUBLICO") {
                    // Tornar privado direto (sem confirmação)
                    visMutation.mutate({ id: item.id, visibilidade: "PRIVADO", autorizado: false });
                  } else {
                    // Publicar → abrir modal de confirmação
                    setPubItem(item);
                    setPubError(null);
                  }
                }}
                title={item.visibilidade === "PUBLICO" ? "Tornar privado" : "Publicar no portal"}
                className={cn(
                  "absolute top-2 right-2 p-1.5 rounded-full transition-all hover:scale-110",
                  item.visibilidade === "PUBLICO"
                    ? "bg-[#2F9285]/90 hover:bg-[#E35D5B]/80"
                    : "bg-[#050B12]/80 hover:bg-[#2F9285]/70"
                )}
              >
                {item.visibilidade === "PUBLICO"
                  ? <Eye size={12} className="text-white" />
                  : <EyeOff size={12} className="text-[#87938F]" />
                }
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ─── Modal: Confirmar autorização de publicação ─── */}
      {pubItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0B171C] border border-[#243337] w-full max-w-sm rounded-[18px] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#243337]">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#2F9285]" />
                <h2 className="text-[#F0EADD] font-bold text-sm">Confirmar autorização</h2>
              </div>
              <button onClick={() => setPubItem(null)} className="text-[#87938F] hover:text-[#F0EADD]">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Preview da imagem */}
              <div className="w-full aspect-square rounded-[12px] overflow-hidden bg-[#050B12] border border-[#243337]">
                <img
                  src={`${API}/api/v1/portfolio/${pubItem.id}/imagem`}
                  alt="Foto para publicar"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Texto de confirmação */}
              <div className="p-3 rounded-[10px] bg-[#D99A3D]/5 border border-[#D99A3D]/20">
                <p className="text-xs text-[#D99A3D] font-semibold mb-1">Antes de publicar, confirme:</p>
                <ul className="text-xs text-[#87938F] space-y-1 list-disc pl-4">
                  <li>O cliente <strong className="text-[#F0EADD]">autorizou</strong> o uso desta imagem</li>
                  <li>A foto não expõe dados sensíveis do cliente</li>
                  <li>Você tem consentimento para uso no portal público</li>
                </ul>
              </div>

              {pubError && (
                <div className="p-2 bg-[#E35D5B]/10 border border-[#E35D5B]/20 text-[#E35D5B] text-xs rounded-lg">
                  {pubError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setPubItem(null)}
                  className="flex-1 h-10 rounded-[12px] border border-[#243337] hover:bg-[#102128] text-[#F0EADD] font-semibold text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  disabled={pubLoading}
                  onClick={async () => {
                    setPubLoading(true);
                    setPubError(null);
                    try {
                      await visMutation.mutateAsync({
                        id: pubItem.id,
                        visibilidade: "PUBLICO",
                        autorizado: true,
                      });
                    } finally {
                      setPubLoading(false);
                    }
                  }}
                  className="flex-1 h-10 rounded-[12px] bg-[#2F9285] hover:bg-[#3AA99A] disabled:opacity-60 text-[#050B12] font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  {pubLoading && <Loader2 size={14} className="animate-spin" />}
                  {pubLoading ? "Publicando..." : "Confirmar e Publicar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
