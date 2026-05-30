"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Zap, Plus, Loader2, X, DollarSign, Maximize2, MapPin, Trash2, Tag, FileText } from "lucide-react";
import { api, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL;

interface FlashArtItem {
  id: string;
  titulo: string;
  descricao: string | null;
  imagem_path: string | null;
  preco: number | null;
  tamanho_sugerido: string | null;
  local_recomendado: string | null;
  status: "DISPONIVEL" | "EM_NEGOCIACAO" | "RESERVADA" | "SINAL_PAGO" | "VENDIDA" | "ARQUIVADA";
  ativo: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  DISPONIVEL:    { label: "Disponível",    cls: "bg-[#54B88D]/15 text-[#54B88D] border-[#54B88D]/30" },
  EM_NEGOCIACAO: { label: "Em Negociação", cls: "bg-[#D99A3D]/15 text-[#D99A3D] border-[#D99A3D]/30" },
  RESERVADA:     { label: "Reservada",     cls: "bg-[#5E9ED6]/15 text-[#5E9ED6] border-[#5E9ED6]/30" },
  SINAL_PAGO:    { label: "Sinal Pago",    cls: "bg-[#8B7CF6]/15 text-[#8B7CF6] border-[#8B7CF6]/30" },
  VENDIDA:       { label: "Vendida",       cls: "bg-[#87938F]/15 text-[#87938F] border-[#87938F]/30" },
};

export default function FlashArtsPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Form states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [tamanho, setTamanho] = useState("");
  const [local, setLocal] = useState("");

  const { data: flashArts = [], isLoading } = useQuery<FlashArtItem[]>({
    queryKey: ["flash-arts"],
    queryFn: () => api.get("/api/v1/flash-arts/"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/v1/flash-arts/${id}/status?status_novo=${status}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flash-arts"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/flash-arts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flash-arts"] });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrorText("Formato de imagem inválido. Use JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setErrorText("Imagem excede o limite de 15MB.");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setSelectedFile(null);
    setPreviewUrl(null);
    setTitulo("");
    setDescricao("");
    setPreco("");
    setTamanho("");
    setLocal("");
    setErrorText(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);

    if (!selectedFile) {
      setErrorText("Selecione uma imagem para a flash art.");
      return;
    }
    if (!titulo.trim()) {
      setErrorText("Digite um título.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("arquivo", selectedFile);
      formData.append("titulo", titulo);
      if (descricao) formData.append("descricao", descricao);
      if (preco) formData.append("preco", preco);
      if (tamanho) formData.append("tamanho_sugerido", tamanho);
      if (local) formData.append("local_recomendado", local);

      const res = await fetch(`${API}/api/v1/flash-arts/`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Erro desconhecido ao criar." }));
        throw new Error(err.detail ?? "Erro no upload.");
      }

      qc.invalidateQueries({ queryKey: ["flash-arts"] });
      setIsModalOpen(false);
    } catch (err: any) {
      setErrorText(err.message ?? "Ocorreu um erro ao salvar.");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number | null) => {
    if (val === null || val === undefined) return "Sob consulta";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EADD]">Flash Arts</h1>
          <p className="text-sm text-[#87938F] mt-1">
            {isLoading ? "Carregando..." : `${flashArts.length} arte${flashArts.length !== 1 ? "s" : ""} cadastrada${flashArts.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={handleOpenModal}
          className="flex items-center gap-2 h-10 px-4 rounded-[14px] bg-[#2F9285] hover:bg-[#3AA99A] text-[#050B12] font-semibold text-sm transition-all shrink-0"
        >
          <Plus size={16} />
          Nova Flash Art
        </button>
      </div>

      {/* Status Legends */}
      <div className="flex flex-wrap gap-2 mb-6">
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <span key={k} className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${v.cls}`}>
            {v.label}
          </span>
        ))}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[#0B171C] border border-[#243337] rounded-[18px] h-72 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && flashArts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-[#0B171C] border border-[#243337] rounded-[18px]">
          <Zap size={48} className="text-[#243337] mb-4 animate-pulse" />
          <h3 className="text-[#F0EADD] font-semibold mb-2">Nenhuma flash art cadastrada</h3>
          <p className="text-sm text-[#87938F] max-w-xs mb-6">
            Cadastre suas flash arts disponíveis para que clientes possam reservar pelo portal público.
          </p>
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 h-10 px-5 rounded-[14px] bg-[#2F9285] hover:bg-[#3AA99A] text-[#050B12] font-semibold text-sm transition-all"
          >
            <Plus size={16} />
            Cadastrar Flash Art
          </button>
        </div>
      )}

      {/* Grid of Flash Arts */}
      {!isLoading && flashArts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {flashArts.map((item) => (
            <div
              key={item.id}
              className="bg-[#0B171C] border border-[#243337] rounded-[18px] overflow-hidden flex flex-col group hover:border-[#2F9285]/40 transition-all relative"
            >
              {/* Image Container */}
              <div className="relative aspect-square w-full bg-[#050B12] border-b border-[#243337] overflow-hidden">
                {item.imagem_path ? (
                  <img
                    src={`${API}/api/v1/flash-arts/${item.id}/imagem`}
                    alt={item.titulo}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#243337]">
                    <Zap size={48} />
                  </div>
                )}
                {/* Actions overlay */}
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  <button
                    onClick={() => {
                      if (confirm("Deseja realmente arquivar esta flash art?")) {
                        deleteMutation.mutate(item.id);
                      }
                    }}
                    className="p-2 rounded-full bg-[#050B12]/80 hover:bg-[#E35D5B]/20 hover:text-[#E35D5B] text-[#87938F] border border-[#243337] transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Status selector overlay (interactive) */}
                <div className="absolute bottom-2 left-2 right-2">
                  <select
                    value={item.status}
                    onChange={(e) => updateStatusMutation.mutate({ id: item.id, status: e.target.value })}
                    className="w-full text-xs font-semibold bg-[#050B12]/95 border border-[#243337] text-[#F0EADD] rounded-lg px-2 py-1 outline-none cursor-pointer focus:border-[#2F9285]/60"
                  >
                    <option value="DISPONIVEL">Disponível</option>
                    <option value="EM_NEGOCIACAO">Em Negociação</option>
                    <option value="RESERVADA">Reservada</option>
                    <option value="SINAL_PAGO">Sinal Pago</option>
                    <option value="VENDIDA">Vendida</option>
                    <option value="ARQUIVADA">Arquivada</option>
                  </select>
                </div>
              </div>

              {/* Details */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-[#F0EADD] line-clamp-1">{item.titulo}</h3>
                  <p className="text-xs text-[#87938F] mt-1 line-clamp-2 min-h-[32px]">
                    {item.descricao || "Sem descrição adicional."}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#243337] flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#87938F] flex items-center gap-1"><DollarSign size={12} /> Preço</span>
                    <span className="font-bold text-[#F0EADD]">{formatCurrency(item.preco)}</span>
                  </div>

                  {item.tamanho_sugerido && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#87938F] flex items-center gap-1"><Maximize2 size={12} /> Tamanho</span>
                      <span className="text-[#smoke-text]">{item.tamanho_sugerido}</span>
                    </div>
                  )}

                  {item.local_recomendado && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#87938F] flex items-center gap-1"><MapPin size={12} /> Região</span>
                      <span className="text-[#smoke-text] truncate max-w-[120px]">{item.local_recomendado}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal dialog for creating Flash Art */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0B171C] border border-[#243337] w-full max-w-lg rounded-[18px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#243337]">
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-[#2F9285]" />
                <h2 className="text-[#F0EADD] font-bold text-base">Nova Flash Art</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-[#87938F] hover:text-[#F0EADD]">
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-5 flex-1 overflow-y-auto space-y-4">
              {errorText && (
                <div className="p-3 bg-[#E35D5B]/10 border border-[#E35D5B]/20 text-[#E35D5B] text-xs rounded-lg flex items-center justify-between">
                  <span>{errorText}</span>
                  <button type="button" onClick={() => setErrorText(null)}><X size={14} /></button>
                </div>
              )}

              {/* Upload area */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#87938F]">Imagem da Arte *</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-dashed border-[#243337] hover:border-[#2F9285]/40 bg-[#050B12] rounded-[14px] p-6 text-center cursor-pointer transition-all relative overflow-hidden aspect-video flex flex-col items-center justify-center"
                >
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="absolute inset-0 w-full h-full object-contain" />
                  ) : (
                    <>
                      <Zap size={24} className="text-[#243337] mb-2" />
                      <p className="text-xs text-[#F0EADD] font-medium">Clique para selecionar imagem</p>
                      <p className="text-[10px] text-[#87938F] mt-1">JPEG, PNG ou WebP até 15MB</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Input: Título */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#87938F] flex items-center gap-1"><Tag size={12} /> Título *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Caveira Old School"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="w-full h-10 px-3 rounded-[10px] bg-[#050B12] border border-[#243337] text-sm text-[#F0EADD] focus:border-[#2F9285]/60 outline-none transition-all"
                />
              </div>

              {/* Input: Descrição */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#87938F] flex items-center gap-1"><FileText size={12} /> Descrição</label>
                <textarea
                  placeholder="Detalhes sobre a arte, conceito ou modificações possíveis..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full h-16 p-3 rounded-[10px] bg-[#050B12] border border-[#243337] text-sm text-[#F0EADD] focus:border-[#2F9285]/60 outline-none transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Input: Preço */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#87938F] flex items-center gap-1"><DollarSign size={12} /> Preço (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 450.00"
                    value={preco}
                    onChange={(e) => setPreco(e.target.value)}
                    className="w-full h-10 px-3 rounded-[10px] bg-[#050B12] border border-[#243337] text-sm text-[#F0EADD] focus:border-[#2F9285]/60 outline-none transition-all"
                  />
                </div>

                {/* Input: Tamanho */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#87938F] flex items-center gap-1"><Maximize2 size={12} /> Tamanho sugerido</label>
                  <input
                    type="text"
                    placeholder="Ex: 12 a 15 cm"
                    value={tamanho}
                    onChange={(e) => setTamanho(e.target.value)}
                    className="w-full h-10 px-3 rounded-[10px] bg-[#050B12] border border-[#243337] text-sm text-[#F0EADD] focus:border-[#2F9285]/60 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Input: Local Recomendado */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#87938F] flex items-center gap-1"><MapPin size={12} /> Local recomendado</label>
                <input
                  type="text"
                  placeholder="Ex: Antebraço, panturrilha"
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                  className="w-full h-10 px-3 rounded-[10px] bg-[#050B12] border border-[#243337] text-sm text-[#F0EADD] focus:border-[#2F9285]/60 outline-none transition-all"
                />
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 pt-4 border-t border-[#243337]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 h-10 rounded-[12px] border border-[#243337] hover:bg-[#102128] text-[#F0EADD] font-semibold text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-10 rounded-[12px] bg-[#2F9285] hover:bg-[#3AA99A] disabled:opacity-60 text-[#050B12] font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  {loading ? "Salvando..." : "Salvar Arte"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

