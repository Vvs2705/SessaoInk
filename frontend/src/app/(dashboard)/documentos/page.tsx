"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Shield, CheckCircle, Clock, Trash2, Loader2, X, ChevronRight, Copy, Check } from "lucide-react";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface Documento {
  id: string;
  tipo: keyof typeof TIPO_CONFIG;
  titulo: string;
  conteudo: string | null;
  versao: string;
  assinado: boolean;
  data_assinatura: string | null;
  cliente_id: string | null;
  atendimento_id: string | null;
  criado_em: string;
}

const TIPO_CONFIG: Record<string, { label: string; cls: string }> = {
  POLITICA_PRIVACIDADE: { label: "Política de Privacidade",       cls: "bg-info/15 text-info border-info/30" },
  TERMOS_USO:           { label: "Termos de Uso",                 cls: "bg-status-finalizado/15 text-status-finalizado border-status-finalizado/30" },
  CONSENTIMENTO:        { label: "Consentimento do Procedimento", cls: "bg-copper-needle/15 text-copper-needle border-copper-needle/30" },
  AUTORIZACAO_IMAGEM:   { label: "Autorização de Imagem",         cls: "bg-teal-ink/15 text-teal-ink border-teal-ink/30" },
  POLITICA_SINAL:       { label: "Política de Sinal",             cls: "bg-warning/15 text-warning border-warning/30" },
  AFTERCARE:            { label: "Aftercare",                     cls: "bg-success/15 text-success border-success/30" },
  OUTRO:                { label: "Outro",                         cls: "bg-mist-line/60 text-text-subtle border-mist-line" },
};

// Templates pré-definidos para criar rapidamente
const TEMPLATES = [
  { tipo: "POLITICA_PRIVACIDADE", titulo: "Política de Privacidade" },
  { tipo: "TERMOS_USO",           titulo: "Termos de Uso do Estúdio" },
  { tipo: "CONSENTIMENTO",        titulo: "Consentimento do Procedimento de Tatuagem" },
  { tipo: "AUTORIZACAO_IMAGEM",   titulo: "Autorização de Uso de Imagem" },
  { tipo: "POLITICA_SINAL",       titulo: "Política de Sinal e Cancelamento" },
  { tipo: "AFTERCARE",            titulo: "Instruções de Cuidado Pós-Tatuagem" },
];

export default function DocumentosPage() {
  const qc = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [viewDoc, setViewDoc] = useState<Documento | null>(null);

  // Campos do formulário
  const [tipo, setTipo] = useState("POLITICA_PRIVACIDADE");
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [versao, setVersao] = useState("1.0");

  const { data: estudio } = useQuery<any>({
    queryKey: ["estudio"],
    queryFn: () => api.get("/api/v1/estudio/"),
  });

  const { data: docs = [], isLoading } = useQuery<Documento[]>({
    queryKey: ["documentos"],
    queryFn: () => api.get("/api/v1/documentos/"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/documentos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documentos"] }),
  });

  const handleOpenModal = (template?: typeof TEMPLATES[number]) => {
    setIsModalOpen(true);
    setTipo(template?.tipo ?? "POLITICA_PRIVACIDADE");
    setTitulo(template?.titulo ?? "");
    setConteudo("");
    setVersao("1.0");
    setErrorText(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    if (!titulo.trim()) { setErrorText("Informe o título do documento."); return; }

    setLoading(true);
    try {
      await api.post("/api/v1/documentos/", {
        tipo,
        titulo: titulo.trim(),
        conteudo: conteudo.trim() || null,
        versao,
      });
      qc.invalidateQueries({ queryKey: ["documentos"] });
      setIsModalOpen(false);
    } catch (err: any) {
      setErrorText(err.message ?? "Erro ao criar documento.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) =>
    dateStr ? new Date(dateStr).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" }) : "—";

  const assinados = docs.filter((d) => d.assinado);
  const pendentes = docs.filter((d) => !d.assinado);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-porcelain-ink">Documentos</h1>
          <p className="text-sm text-text-subtle mt-1">
            {isLoading ? "Carregando..." : `${docs.length} documento${docs.length !== 1 ? "s" : ""} · ${assinados.length} assinado${assinados.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 h-10 px-4 rounded-[14px] bg-teal-ink hover:bg-ink-gold text-ink-night font-semibold text-sm transition-all shrink-0"
        >
          <Plus size={16} />
          Novo Documento
        </button>
      </div>

      {/* Info LGPD */}
      <div className="flex items-start gap-3 p-4 mb-6 rounded-[14px] bg-teal-ink/5 border border-teal-ink/20">
        <Shield size={18} className="text-teal-ink mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-porcelain-ink mb-1">Conformidade LGPD</p>
          <p className="text-xs text-text-subtle">
            Documentos assinados ficam registrados com data, hora e IP. O cliente pode solicitar cópias ou exclusão a qualquer momento.
          </p>
        </div>
      </div>

      {/* Templates rápidos */}
      <div className="mb-8">
        <h2 className="text-xs font-bold text-text-subtle uppercase tracking-wider mb-3">Criar a partir de template</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TEMPLATES.map((t) => {
            const cfg = TIPO_CONFIG[t.tipo];
            return (
              <button
                key={t.tipo}
                onClick={() => handleOpenModal(t)}
                className="flex items-center gap-3 p-4 rounded-[14px] bg-ink-bg border border-mist-line hover:border-teal-ink/40 hover:bg-surface-raised transition-all text-left group"
              >
                <FileText size={16} className="text-teal-ink shrink-0" />
                <span className="text-sm text-porcelain-ink flex-1">{t.titulo}</span>
                <ChevronRight size={14} className="text-mist-line group-hover:text-teal-ink transition-colors" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-ink-bg border border-mist-line rounded-[14px] animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && docs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-ink-bg border border-mist-line rounded-[18px]">
          <FileText size={40} className="text-mist-line mb-3" />
          <p className="text-sm text-text-subtle">Nenhum documento criado ainda</p>
          <p className="text-xs text-text-subtle/60 mt-1">Use os templates acima para começar</p>
        </div>
      )}

      {/* Documentos pendentes (não assinados) */}
      {!isLoading && pendentes.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-bold text-text-subtle uppercase tracking-wider mb-3 flex items-center gap-2">
            <Clock size={12} /> Pendentes de assinatura ({pendentes.length})
          </h2>
          <div className="space-y-2">
            {pendentes.map((doc) => (
              <DocRow key={doc.id} doc={doc} slug={estudio?.slug || ""} onView={setViewDoc} onDelete={(id) => {
                if (confirm(`Excluir "${doc.titulo}"?`)) deleteMutation.mutate(id);
              }} />
            ))}
          </div>
        </div>
      )}

      {/* Documentos assinados */}
      {!isLoading && assinados.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-text-subtle uppercase tracking-wider mb-3 flex items-center gap-2">
            <CheckCircle size={12} className="text-success" /> Assinados ({assinados.length})
          </h2>
          <div className="space-y-2">
            {assinados.map((doc) => (
              <DocRow key={doc.id} doc={doc} slug={estudio?.slug || ""} onView={setViewDoc} onDelete={(id) => {
                if (confirm(`Excluir "${doc.titulo}"?`)) deleteMutation.mutate(id);
              }} />
            ))}
          </div>
        </div>
      )}

      {/* ─── Modal Novo Documento ─── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-ink-bg border border-mist-line w-full max-w-lg rounded-[18px] shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-mist-line">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-teal-ink" />
                <h2 className="text-porcelain-ink font-bold text-base">Novo Documento</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-text-subtle hover:text-porcelain-ink">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 flex-1 overflow-y-auto space-y-4">
              {errorText && (
                <div className="p-3 bg-error-red/10 border border-error-red/20 text-error-red text-xs rounded-lg flex items-center justify-between">
                  <span>{errorText}</span>
                  <button type="button" onClick={() => setErrorText(null)}><X size={14} /></button>
                </div>
              )}

              {/* Tipo */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-subtle">Tipo de Documento</label>
                <select
                  value={tipo} onChange={(e) => setTipo(e.target.value)}
                  className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-mist-line text-sm text-porcelain-ink focus:border-teal-ink/60 outline-none transition-all"
                >
                  {Object.entries(TIPO_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              {/* Título */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-subtle">Título *</label>
                <input
                  type="text" required
                  placeholder="Nome do documento"
                  value={titulo} onChange={(e) => setTitulo(e.target.value)}
                  className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-mist-line text-sm text-porcelain-ink focus:border-teal-ink/60 outline-none transition-all"
                />
              </div>

              {/* Versão */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-subtle">Versão</label>
                <input
                  type="text"
                  placeholder="1.0"
                  value={versao} onChange={(e) => setVersao(e.target.value)}
                  className="w-full h-10 px-3 rounded-[10px] bg-ink-night border border-mist-line text-sm text-porcelain-ink focus:border-teal-ink/60 outline-none transition-all"
                />
              </div>

              {/* Conteúdo */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-subtle">Conteúdo do Documento</label>
                <textarea
                  placeholder="Cole ou escreva o texto completo do documento aqui..."
                  value={conteudo} onChange={(e) => setConteudo(e.target.value)}
                  rows={8}
                  className="w-full p-3 rounded-[10px] bg-ink-night border border-mist-line text-sm text-porcelain-ink focus:border-teal-ink/60 outline-none transition-all resize-none leading-relaxed"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-mist-line">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 h-10 rounded-[12px] border border-mist-line hover:bg-surface-raised text-porcelain-ink font-semibold text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit" disabled={loading}
                  className="flex-1 h-10 rounded-[12px] bg-teal-ink hover:bg-ink-gold disabled:opacity-60 text-ink-night font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={15} className="animate-spin" />}
                  {loading ? "Salvando..." : "Criar Documento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal Visualizar Documento ─── */}
      {viewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-ink-bg border border-mist-line w-full max-w-2xl rounded-[18px] shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-start justify-between px-5 py-4 border-b border-mist-line">
              <div>
                <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border", TIPO_CONFIG[viewDoc.tipo]?.cls)}>
                  {TIPO_CONFIG[viewDoc.tipo]?.label ?? viewDoc.tipo}
                </span>
                <h2 className="text-porcelain-ink font-bold text-base mt-2">{viewDoc.titulo}</h2>
                <p className="text-xs text-text-subtle mt-0.5">v{viewDoc.versao} · Criado em {formatDate(viewDoc.criado_em)}</p>
              </div>
              <button onClick={() => setViewDoc(null)} className="text-text-subtle hover:text-porcelain-ink mt-1">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {viewDoc.assinado && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-[10px] bg-success/10 border border-success/20 text-sm text-success">
                  <CheckCircle size={14} />
                  Assinado em {formatDate(viewDoc.data_assinatura)}
                </div>
              )}
              {viewDoc.conteudo ? (
                <pre className="text-sm text-porcelain-ink/80 whitespace-pre-wrap font-sans leading-relaxed">{viewDoc.conteudo}</pre>
              ) : (
                <p className="text-sm text-text-subtle italic">Documento sem conteúdo definido.</p>
              )}
            </div>

            <div className="px-5 py-4 border-t border-mist-line">
              <button
                onClick={() => setViewDoc(null)}
                className="w-full h-10 rounded-[12px] border border-mist-line hover:bg-surface-raised text-porcelain-ink font-semibold text-sm transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-componente para linha de documento
function DocRow({
  doc,
  slug,
  onView,
  onDelete,
}: {
  doc: Documento;
  slug: string;
  onView: (d: Documento) => void;
  onDelete: (id: string) => void;
}) {
  const cfg = TIPO_CONFIG[doc.tipo];
  const formatDate = (dateStr: string | null) =>
    dateStr ? new Date(dateStr).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "short" }) : "—";

  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const link = `${origin}/${slug}/documento/${doc.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-3 p-4 bg-ink-bg border border-mist-line rounded-[14px] hover:border-teal-ink/30 transition-all group">
      <div className={cn("p-2 rounded-[10px]", cfg?.cls?.split(" ").slice(0, 1).join(" ") ?? "bg-mist-line/30")}>
        <FileText size={15} className={cfg?.cls?.split(" ").slice(1, 2).join(" ") ?? "text-text-subtle"} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-porcelain-ink truncate">{doc.titulo}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn("text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border", cfg?.cls)}>
            {cfg?.label ?? doc.tipo}
          </span>
          <span className="text-[10px] text-text-subtle">v{doc.versao}</span>
          <span className="text-[10px] text-text-subtle">· {formatDate(doc.criado_em)}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {doc.assinado ? (
          <span className="flex items-center gap-1 text-[10px] text-success font-semibold bg-success/10 border border-success/20 px-2 py-1 rounded-full">
            <CheckCircle size={10} /> Assinado
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] text-warning font-semibold bg-warning/10 border border-warning/20 px-2 py-1 rounded-full">
            <Clock size={10} /> Pendente
          </span>
        )}
        
        {!doc.assinado && slug && (
          <button
            onClick={handleCopyLink}
            className="p-1.5 rounded-[8px] text-teal-ink hover:text-ink-gold hover:bg-teal-ink/10 transition-all"
            title="Copiar link de assinatura"
          >
            {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
          </button>
        )}

        <button
          onClick={() => onView(doc)}
          className="p-1.5 rounded-[8px] text-text-subtle hover:text-porcelain-ink hover:bg-surface-raised transition-all"
          title="Ver documento"
        >
          <FileText size={13} />
        </button>
        <button
          onClick={() => onDelete(doc.id)}
          className="p-1.5 rounded-[8px] text-error-red/50 hover:text-error-red hover:bg-error-red/10 transition-all"
          title="Excluir"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
