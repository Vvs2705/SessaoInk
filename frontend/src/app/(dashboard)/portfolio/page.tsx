"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Image as ImageIcon,
  Upload,
  Eye,
  EyeOff,
  Loader2,
  X,
  ShieldCheck,
  Trash2,
  RotateCcw,
  Search,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { api, withCsrfHeaders } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

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

interface Usuario {
  id: string;
  nome: string;
  email: string;
  tipo: "ADMIN" | "ARTISTA" | "RECEPCIONISTA";
  estudio_id: string;
}

function Toast({
  tipo,
  mensagem,
  onClose,
}: {
  tipo: "sucesso" | "erro";
  mensagem: string;
  onClose: () => void;
}) {
  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-[14px] border shadow-xl z-50 animate-in slide-in-from-bottom-4",
        tipo === "sucesso"
          ? "bg-[#0B171C] border-[#2F9285]/40 text-[#2F9285]"
          : "bg-[#0B171C] border-[#E35D5B]/40 text-[#E35D5B]"
      )}
    >
      {tipo === "sucesso" ? (
        <CheckCircle size={16} />
      ) : (
        <AlertCircle size={16} />
      )}
      <span className="text-sm font-medium text-[#F0EADD]">{mensagem}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  );
}

export default function PortfolioPage() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [erroUpload, setErroUpload] = useState<string | null>(null);

  // Controle de Abas, busca e filtros
  const [visualizacao, setVisualizacao] = useState<"ativas" | "arquivadas">("ativas");
  const [busca, setBusca] = useState("");
  const [filtroVisibilidade, setFiltroVisibilidade] = useState<"TODOS" | "PUBLICO" | "PRIVADO">("TODOS");

  // Feedback visual (Toast)
  const [toast, setToast] = useState<{ tipo: "sucesso" | "erro"; mensagem: string } | null>(null);

  const showToast = (tipo: "sucesso" | "erro", mensagem: string) => {
    setToast({ tipo, mensagem });
    setTimeout(() => setToast(null), 4000);
  };

  // Modal de confirmação de autorização de publicação
  const [pubItem, setPubItem] = useState<PortfolioItem | null>(null);
  const [pubLoading, setPubLoading] = useState(false);
  const [pubError, setPubError] = useState<string | null>(null);

  // Modal de confirmação de arquivamento
  const [arqItem, setArqItem] = useState<PortfolioItem | null>(null);
  const [arqError, setArqError] = useState<string | null>(null);

  // Modal de exclusão permanente
  const [permItem, setPermItem] = useState<PortfolioItem | null>(null);
  const [confirmTexto, setConfirmTexto] = useState("");
  const [permError, setPermError] = useState<string | null>(null);

  // Queries
  const { data: usuario } = useQuery<Usuario>({
    queryKey: ["usuario"],
    queryFn: () => api.get<Usuario>("/api/v1/auth/me"),
  });

  const isAdmin = usuario?.tipo === "ADMIN";

  const { data = [], isLoading } = useQuery<PortfolioItem[]>({
    queryKey: ["portfolio"],
    queryFn: () => api.get("/api/v1/portfolio/"),
  });

  const { data: arquivados = [], isLoading: isLoadingArquivados } = useQuery<PortfolioItem[]>({
    queryKey: ["portfolio-arquivados"],
    queryFn: () => api.get("/api/v1/portfolio/arquivados"),
    enabled: !!isAdmin, // Carrega sempre para o admin para exibir o contador na aba
  });

  // Mutações
  const visMutation = useMutation({
    mutationFn: ({ id, visibilidade, autorizado }: { id: string; visibilidade: string; autorizado: boolean }) =>
      api.patch(`/api/v1/portfolio/${id}/visibilidade?visibilidade=${visibilidade}&autorizado=${autorizado}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio"] });
      setPubItem(null);
      showToast("sucesso", "Visibilidade alterada com sucesso!");
    },
    onError: (err: any) => {
      setPubError(err?.detail ?? err?.message ?? "Erro ao alterar visibilidade.");
      showToast("erro", err?.detail ?? err?.message ?? "Erro ao alterar visibilidade.");
    },
  });

  // Arquivar = DELETE real (soft delete no backend). Remove da listagem e do portal.
  const arquivarMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/portfolio/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio"] });
      qc.invalidateQueries({ queryKey: ["portfolio-arquivados"] });
      setArqItem(null);
      showToast("sucesso", "Foto arquivada com sucesso!");
    },
    onError: (err: any) => {
      setArqError(err?.detail ?? err?.message ?? "Erro ao arquivar a foto.");
      showToast("erro", err?.detail ?? err?.message ?? "Erro ao arquivar a foto.");
    },
  });

  // Restaurar foto arquivada
  const restaurarMutation = useMutation({
    mutationFn: (id: string) => api.patch<PortfolioItem>(`/api/v1/portfolio/${id}/restaurar`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio"] });
      qc.invalidateQueries({ queryKey: ["portfolio-arquivados"] });
      showToast("sucesso", "Foto restaurada com sucesso!");
    },
    onError: (err: any) => {
      showToast("erro", err?.detail ?? err?.message ?? "Erro ao restaurar a foto.");
    },
  });

  // Excluir permanentemente (Admin)
  const permanenteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/portfolio/${id}/permanente`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio-arquivados"] });
      setPermItem(null);
      setConfirmTexto("");
      showToast("sucesso", "Foto excluída permanentemente!");
    },
    onError: (err: any) => {
      setPermError(err?.detail ?? err?.message ?? "Erro ao excluir permanentemente.");
      showToast("erro", err?.detail ?? err?.message ?? "Erro ao excluir permanentemente.");
    },
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
      await fetch(`${API}/api/v1/portfolio/upload`, withCsrfHeaders({
        method: "POST",
        credentials: "include",
        body: form,
      })).then(async r => {
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

  // Filtragem local das fotos
  const itemsFiltrados = data.filter(item => {
    const atendeBusca = !busca ||
      (item.titulo && item.titulo.toLowerCase().includes(busca.toLowerCase())) ||
      (item.estilo && item.estilo.toLowerCase().includes(busca.toLowerCase())) ||
      (item.parte_corpo && item.parte_corpo.toLowerCase().includes(busca.toLowerCase()));

    const atendeVisibilidade = filtroVisibilidade === "TODOS" || item.visibilidade === filtroVisibilidade;

    return atendeBusca && atendeVisibilidade;
  });

  const arquivadosFiltrados = arquivados.filter(item => {
    return !busca ||
      (item.titulo && item.titulo.toLowerCase().includes(busca.toLowerCase())) ||
      (item.estilo && item.estilo.toLowerCase().includes(busca.toLowerCase())) ||
      (item.parte_corpo && item.parte_corpo.toLowerCase().includes(busca.toLowerCase()));
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EADD]">Portfólio</h1>
          <p className="text-sm text-[#87938F] mt-1">
            {visualizacao === "ativas"
              ? (isLoading ? "Carregando..." : `${data.length} foto${data.length !== 1 ? "s" : ""}`)
              : (isLoadingArquivados ? "Carregando..." : `${arquivados.length} foto${arquivados.length !== 1 ? "s" : ""} arquivada${arquivados.length !== 1 ? "s" : ""}`)
            }
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

      {/* Alternância de Abas (somente Admin) */}
      {isAdmin && (
        <div className="flex gap-2 mb-6 border-b border-[#243337] pb-3">
          <button
            onClick={() => setVisualizacao("ativas")}
            className={cn(
              "px-4 py-2 rounded-[10px] text-sm font-medium transition-all border",
              visualizacao === "ativas"
                ? "bg-[#2F9285]/10 text-[#2F9285] border-[#2F9285]/30"
                : "text-[#87938F] hover:text-[#F0EADD] border-transparent"
            )}
          >
            Fotos Ativas ({data.length})
          </button>
          <button
            onClick={() => setVisualizacao("arquivadas")}
            className={cn(
              "px-4 py-2 rounded-[10px] text-sm font-medium transition-all border",
              visualizacao === "arquivadas"
                ? "bg-[#2F9285]/10 text-[#2F9285] border-[#2F9285]/30"
                : "text-[#87938F] hover:text-[#F0EADD] border-transparent"
            )}
          >
            Fotos Arquivadas ({arquivados.length})
          </button>
        </div>
      )}

      {/* Barra de Busca e Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#87938F]" />
          <input
            type="text"
            placeholder="Buscar por título, estilo ou parte do corpo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-[#050B12] border border-[#243337] rounded-[10px] pl-10 pr-4 py-2.5 text-sm text-[#F0EADD] placeholder-[#87938F] focus:outline-none focus:border-[#2F9285]/50 transition-colors"
          />
          {busca && (
            <button
              onClick={() => setBusca("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#87938F] hover:text-[#F0EADD]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {visualizacao === "ativas" && (
          <select
            value={filtroVisibilidade}
            onChange={(e) => setFiltroVisibilidade(e.target.value as any)}
            className="bg-[#050B12] border border-[#243337] rounded-[10px] px-3 py-2.5 text-sm text-[#F0EADD] focus:outline-none focus:border-[#2F9285]/50 transition-colors"
          >
            <option value="TODOS">Todos os Status</option>
            <option value="PUBLICO">Públicos</option>
            <option value="PRIVADO">Privados</option>
          </select>
        )}
      </div>

      {/* ---- VISUALIZAÇÃO: ATIVAS ---- */}
      {visualizacao === "ativas" && (
        <>
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

          {!isLoading && itemsFiltrados.length === 0 && (
            <div className="bg-[#0B171C] border border-[#243337] rounded-[18px]">
              <EmptyState
                title={
                  busca || filtroVisibilidade !== "TODOS"
                    ? "Nenhuma foto encontrada"
                    : "Seu portfólio começa aqui"
                }
                description={
                  busca || filtroVisibilidade !== "TODOS"
                    ? "Tente ajustar seus termos de busca ou filtros."
                    : "Adicione fotos das suas tatuagens — tudo fica privado até você autorizar a publicação no portal."
                }
                action={
                  !busca && filtroVisibilidade === "TODOS" ? (
                    <button
                      onClick={() => inputRef.current?.click()}
                      className="flex items-center gap-2 h-11 px-5 rounded-[14px] bg-[#2F9285] hover:bg-[#3AA99A] text-[#050B12] font-semibold text-sm transition-colors"
                    >
                      <Upload size={16} />
                      Adicionar primeira foto
                    </button>
                  ) : undefined
                }
              />
            </div>
          )}

          {/* Galeria masonry: colunas CSS preservam a proporção natural de cada
              tatuagem (vertical/horizontal), em vez de cortar tudo em quadrado. */}
          {!isLoading && itemsFiltrados.length > 0 && (
            <div className="columns-2 md:columns-3 lg:columns-4 gap-3 [column-fill:_balance]">
              {itemsFiltrados.map(item => (
                <div
                  key={item.id}
                  className="relative mb-3 break-inside-avoid bg-[#0B171C] border border-[#243337] rounded-[14px] overflow-hidden group hover:border-[#2F9285]/50 hover:shadow-[0_8px_30px_rgba(0,0,0,0.45)] transition-all duration-300"
                >
                  <img
                    src={`${API}/api/v1/portfolio/${item.id}/imagem`}
                    alt={item.titulo ?? "Foto portfólio"}
                    className="w-full h-auto object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050B12]/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                    {item.titulo && <p className="text-xs font-semibold text-[#F0EADD] truncate">{item.titulo}</p>}
                    {item.estilo && <p className="text-[10px] text-[#87938F]">{item.estilo}</p>}
                  </div>
                  {/* Badge visibilidade — clicável */}
                  <button
                    onClick={() => {
                      if (item.visibilidade === "PUBLICO") {
                        visMutation.mutate({ id: item.id, visibilidade: "PRIVADO", autorizado: false });
                      } else {
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
                  {/* Botão arquivar */}
                  <button
                    onClick={() => { setArqItem(item); setArqError(null); }}
                    title="Arquivar foto"
                    aria-label="Arquivar foto"
                    className="absolute top-2 left-2 p-1.5 rounded-full bg-[#050B12]/80 hover:bg-[#E35D5B]/80 transition-all hover:scale-110 opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={12} className="text-[#F0EADD]" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ---- VISUALIZAÇÃO: ARQUIVADAS (ADMIN) ---- */}
      {visualizacao === "arquivadas" && isAdmin && (
        <>
          {isLoadingArquivados && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {[1,2,3,4].map(i => <div key={i} className="aspect-square bg-[#0B171C] rounded-[14px] animate-pulse" />)}
            </div>
          )}

          {!isLoadingArquivados && arquivadosFiltrados.length === 0 && (
            <div className="bg-[#0B171C] border border-[#243337] rounded-[18px]">
              <EmptyState
                title="Nenhuma foto arquivada"
                description={
                  busca
                    ? "Tente ajustar seus termos de busca."
                    : "Fotos que você arquivar aparecerão aqui — restauráveis ou excluíveis permanentemente."
                }
              />
            </div>
          )}

          {!isLoadingArquivados && arquivadosFiltrados.length > 0 && (
            <div className="columns-2 md:columns-3 lg:columns-4 gap-3 [column-fill:_balance]">
              {arquivadosFiltrados.map(item => (
                <div
                  key={item.id}
                  className="relative mb-3 break-inside-avoid bg-[#0B171C] border border-[#243337] rounded-[14px] overflow-hidden group hover:border-[#2F9285]/40 transition-all"
                >
                  <img
                    src={`${API}/api/v1/portfolio/${item.id}/imagem`}
                    alt={item.titulo ?? "Foto portfólio"}
                    className="w-full h-auto object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all"
                    loading="lazy"
                  />
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050B12]/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                    {item.titulo && <p className="text-xs font-semibold text-[#F0EADD] truncate">{item.titulo}</p>}
                    {item.estilo && <p className="text-[10px] text-[#87938F]">{item.estilo}</p>}
                  </div>
                  {/* Controles */}
                  <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => restaurarMutation.mutate(item.id)}
                      title="Restaurar foto"
                      className="p-1.5 rounded-full bg-[#050B12]/80 hover:bg-[#2F9285] hover:text-[#050B12] text-[#2F9285] transition-all hover:scale-110"
                    >
                      <RotateCcw size={12} />
                    </button>
                    <button
                      onClick={() => { setPermItem(item); setPermError(null); setConfirmTexto(""); }}
                      title="Excluir permanentemente"
                      className="p-1.5 rounded-full bg-[#050B12]/80 hover:bg-[#E35D5B] hover:text-[#F0EADD] text-[#E35D5B] transition-all hover:scale-110"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── Modal: Confirmar arquivamento ─── */}
      {arqItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0B171C] border border-[#243337] w-full max-w-sm rounded-[18px] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#243337]">
              <div className="flex items-center gap-2">
                <Trash2 size={18} className="text-[#E35D5B]" />
                <h2 className="text-[#F0EADD] font-bold text-sm">Arquivar foto?</h2>
              </div>
              <button onClick={() => setArqItem(null)} className="text-[#87938F] hover:text-[#F0EADD]">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="w-full aspect-square rounded-[12px] overflow-hidden bg-[#050B12] border border-[#243337]">
                <img src={`${API}/api/v1/portfolio/${arqItem.id}/imagem`} alt="Foto para arquivar" className="w-full h-full object-cover" />
              </div>
              {arqError && <div className="p-2 bg-[#E35D5B]/10 border border-[#E35D5B]/20 text-[#E35D5B] text-xs rounded-lg">{arqError}</div>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setArqItem(null)} className="flex-1 h-10 rounded-[12px] border border-[#243337] hover:bg-[#102128] text-[#F0EADD] font-semibold text-sm">Cancelar</button>
                <button type="button" disabled={arquivarMutation.isPending} onClick={() => arquivarMutation.mutate(arqItem.id)} className="flex-1 h-10 rounded-[12px] bg-[#E35D5B] hover:bg-[#c94d4b] disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2">
                  {arquivarMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                  {arquivarMutation.isPending ? "Arquivando..." : "Arquivar"}
                </button>
              </div>
            </div>
          </div>
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
              <div className="w-full aspect-square rounded-[12px] overflow-hidden bg-[#050B12] border border-[#243337]">
                <img src={`${API}/api/v1/portfolio/${pubItem.id}/imagem`} alt="Foto para publicar" className="w-full h-full object-cover" />
              </div>
              {pubError && <div className="p-2 bg-[#E35D5B]/10 border border-[#E35D5B]/20 text-[#E35D5B] text-xs rounded-lg">{pubError}</div>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setPubItem(null)} className="flex-1 h-10 rounded-[12px] border border-[#243337] hover:bg-[#102128] text-[#F0EADD] font-semibold text-sm">Cancelar</button>
                <button type="button" disabled={pubLoading} onClick={async () => {
                  setPubLoading(true); setPubError(null);
                  try { await visMutation.mutateAsync({ id: pubItem.id, visibilidade: "PUBLICO", autorizado: true }); } finally { setPubLoading(false); }
                }} className="flex-1 h-10 rounded-[12px] bg-[#2F9285] hover:bg-[#3AA99A] disabled:opacity-60 text-[#050B12] font-semibold text-sm flex items-center justify-center gap-2">
                  {pubLoading && <Loader2 size={14} className="animate-spin" />}
                  {pubLoading ? "Publicando..." : "Confirmar e Publicar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Confirmar exclusão permanente (Admin) ─── */}
      {permItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0B171C] border border-[#243337] w-full max-w-sm rounded-[18px] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#243337]">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-[#E35D5B]" />
                <h2 className="text-[#F0EADD] font-bold text-sm">Excluir permanentemente?</h2>
              </div>
              <button onClick={() => setPermItem(null)} className="text-[#87938F] hover:text-[#F0EADD]">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="w-full aspect-square rounded-[12px] overflow-hidden bg-[#050B12] border border-[#243337]">
                <img src={`${API}/api/v1/portfolio/${permItem.id}/imagem`} alt="Foto para exclusão" className="w-full h-full object-cover" />
              </div>
              <div className="p-3 bg-[#E35D5B]/5 border border-[#E35D5B]/20 text-[#E35D5B] text-xs rounded-[10px]">
                <p className="font-semibold">Esta ação é irreversível.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#87938F]">Digite <strong className="text-[#F0EADD]">EXCLUIR</strong>:</label>
                <input type="text" value={confirmTexto} onChange={(e) => setConfirmTexto(e.target.value)} placeholder="EXCLUIR" className="w-full bg-[#050B12] border border-[#243337] rounded-[10px] px-3 py-2 text-sm text-[#F0EADD]" />
              </div>
              {permError && <div className="p-2 bg-[#E35D5B]/10 border border-[#E35D5B]/20 text-[#E35D5B] text-xs rounded-lg">{permError}</div>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setPermItem(null)} className="flex-1 h-10 rounded-[12px] border border-[#243337] hover:bg-[#102128] text-[#F0EADD] font-semibold text-sm">Cancelar</button>
                <button type="button" disabled={confirmTexto !== "EXCLUIR" || permanenteMutation.isPending} onClick={() => permanenteMutation.mutate(permItem.id)} className="flex-1 h-10 rounded-[12px] bg-[#E35D5B] hover:bg-[#c94d4b] disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2">
                  {permanenteMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                  {permanenteMutation.isPending ? "Excluindo..." : "Excluir permanentemente"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <Toast
          tipo={toast.tipo}
          mensagem={toast.mensagem}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
