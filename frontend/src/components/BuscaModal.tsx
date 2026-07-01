"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Search, X, User, ClipboardList, Zap, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResultItem {
  id: string;
  tipo: "cliente" | "atendimento" | "flash_art";
  titulo: string;
  subtitulo?: string;
  status?: string;
}

interface BuscaResponse {
  q: string;
  total: number;
  clientes: ResultItem[];
  atendimentos: ResultItem[];
  flash_arts: ResultItem[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIPO_ICON = {
  cliente: User,
  atendimento: ClipboardList,
  flash_art: Zap,
};

const TIPO_HREF: Record<string, string> = {
  cliente: "/clientes",
  atendimento: "/atendimentos",
  flash_art: "/flash-arts",
};

const TIPO_LABEL: Record<string, string> = {
  cliente: "Clientes",
  atendimento: "Atendimentos",
  flash_art: "Flash Arts",
};

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function BuscaModal({
  aberto,
  onFechar,
}: {
  aberto: boolean;
  onFechar: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [resultado, setResultado] = useState<BuscaResponse | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [indiceSelecionado, setIndiceSelecionado] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Foco no input ao abrir
  useEffect(() => {
    if (aberto) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResultado(null);
      setIndiceSelecionado(-1);
    }
  }, [aberto]);

  // Busca com debounce de 300ms
  const buscar = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResultado(null);
      return;
    }
    setCarregando(true);
    try {
      const data = await api.get<BuscaResponse>(
        `/api/v1/busca/?q=${encodeURIComponent(q)}&limite=5`
      );
      setResultado(data);
      setIndiceSelecionado(-1);
    } catch {
      setResultado(null);
    } finally {
      setCarregando(false);
    }
  }, []);

  const handleChange = (valor: string) => {
    setQuery(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscar(valor), 300);
  };

  // Lista plana para navegação com teclado
  const todosItens: ResultItem[] = resultado
    ? [
        ...resultado.clientes.map((c) => ({ ...c, tipo: "cliente" as const })),
        ...resultado.atendimentos.map((a) => ({ ...a, tipo: "atendimento" as const })),
        ...resultado.flash_arts.map((f) => ({ ...f, tipo: "flash_art" as const })),
      ]
    : [];

  const navegar = (item: ResultItem) => {
    router.push(`${TIPO_HREF[item.tipo]}?destaque=${item.id}`);
    onFechar();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onFechar(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndiceSelecionado((i) => Math.min(i + 1, todosItens.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndiceSelecionado((i) => Math.max(i - 1, -1));
    }
    if (e.key === "Enter" && indiceSelecionado >= 0) {
      navegar(todosItens[indiceSelecionado]);
    }
  };

  if (!aberto) return null;

  // Agrupar por tipo para renderização
  const grupos: { tipo: string; itens: ResultItem[] }[] = [];
  if (resultado?.clientes.length) grupos.push({ tipo: "cliente", itens: resultado.clientes });
  if (resultado?.atendimentos.length) grupos.push({ tipo: "atendimento", itens: resultado.atendimentos });
  if (resultado?.flash_arts.length) grupos.push({ tipo: "flash_art", itens: resultado.flash_arts });

  let itemGlobal = -1; // contador para índice global de seleção

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-ink-night/80 backdrop-blur-sm"
        onClick={onFechar}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-ink-bg border border-mist-line rounded-[18px] shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-mist-line">
          {carregando ? (
            <Loader2 size={18} className="text-text-subtle shrink-0 animate-spin" />
          ) : (
            <Search size={18} className="text-text-subtle shrink-0" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar clientes, atendimentos, flash arts…"
            className="flex-1 bg-transparent text-sm text-porcelain-ink placeholder-text-subtle outline-none"
          />
          {query && (
            <button onClick={() => { setQuery(""); setResultado(null); }} className="text-text-subtle hover:text-porcelain-ink">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Resultados */}
        <div className="max-h-[360px] overflow-y-auto">
          {query.length < 2 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Search size={28} className="text-mist-line mb-2" />
              <p className="text-sm text-text-subtle">Digite pelo menos 2 caracteres para buscar</p>
              <p className="text-xs text-mist-line mt-1">Clientes · Atendimentos · Flash Arts</p>
            </div>
          )}

          {query.length >= 2 && !carregando && resultado?.total === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-text-subtle">Nenhum resultado para <span className="text-porcelain-ink">"{query}"</span></p>
            </div>
          )}

          {grupos.map(({ tipo, itens }) => {
            const Icon = TIPO_ICON[tipo as keyof typeof TIPO_ICON];
            return (
              <div key={tipo}>
                <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-text-subtle bg-ink-night/40 border-b border-mist-line">
                  {TIPO_LABEL[tipo]}
                </div>
                {itens.map((item) => {
                  itemGlobal++;
                  const idx = itemGlobal;
                  const selecionado = indiceSelecionado === idx;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navegar(item)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-raised transition-colors",
                        selecionado && "bg-surface-raised"
                      )}
                    >
                      <div className={cn(
                        "p-1.5 rounded-[6px] shrink-0",
                        tipo === "cliente" ? "bg-teal-ink/15 text-teal-ink" :
                        tipo === "atendimento" ? "bg-copper-needle/15 text-copper-needle" :
                        "bg-text-subtle/15 text-text-subtle"
                      )}>
                        <Icon size={13} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-porcelain-ink truncate">{item.titulo}</p>
                        {item.subtitulo && (
                          <p className="text-xs text-text-subtle truncate">{item.subtitulo}</p>
                        )}
                      </div>
                      {item.status && (
                        <span className="text-[10px] text-text-subtle bg-ink-night border border-mist-line px-1.5 py-0.5 rounded-[4px] shrink-0">
                          {item.status}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-mist-line">
          <span className="text-[10px] text-text-subtle">↑↓ navegar</span>
          <span className="text-[10px] text-text-subtle">↵ abrir</span>
          <span className="text-[10px] text-text-subtle">Esc fechar</span>
          {resultado && (
            <span className="ml-auto text-[10px] text-text-subtle">
              {resultado.total} resultado{resultado.total !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
