"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchResultItem {
  id: string;
  /** Chave do grupo ao qual o item pertence (ver SearchGroupConfig.key). */
  group: string;
  title: string;
  subtitle?: string;
  status?: string;
}

export interface SearchGroupConfig {
  key: string;
  /** Cabeçalho do grupo (ex.: "Clientes"). */
  label: string;
  /** Ícone do item (ex.: <User size={13} />). */
  icon: ReactNode;
  /** Classes do chip do ícone (ex.: "bg-primary/15 text-primary"). */
  iconClassName?: string;
}

export interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  /** Executa a busca (já debounced pelo modal) e retorna itens + total. */
  onSearch: (q: string) => Promise<{ items: SearchResultItem[]; total: number }>;
  /** Grupos exibidos, na ordem. Itens de grupos não listados são ignorados. */
  groups: SearchGroupConfig[];
  /** Navegação/ação ao escolher um item (clique ou Enter). */
  onSelect: (item: SearchResultItem) => void;
  placeholder?: string;
  /** Dica exibida antes da busca (ex.: "Clientes · Atendimentos"). */
  emptyHint?: string;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Modal de busca global V-STACK: input com debounce (300ms), resultados
 * agrupados, navegação por teclado (↑↓ Enter Esc) e contagem no rodapé.
 *
 * Genérico por config: os grupos (label/ícone/cores) e as funções de busca e
 * navegação vêm do consumidor. Usa apenas tokens semânticos shadcn
 * (background/border/foreground/muted/accent) — a identidade de cada produto
 * entra pelo mapeamento de tokens, não aqui.
 */
export function SearchModal({
  open,
  onClose,
  onSearch,
  groups,
  onSelect,
  placeholder = "Buscar…",
  emptyHint,
}: SearchModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchResultItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Foco no input ao abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setItems(null);
      setSelectedIndex(-1);
    }
  }, [open]);

  // Busca com debounce de 300ms
  const search = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setItems(null);
        return;
      }
      setLoading(true);
      try {
        const data = await onSearch(q);
        setItems(data.items);
        setTotal(data.total);
        setSelectedIndex(-1);
      } catch {
        setItems(null);
      } finally {
        setLoading(false);
      }
    },
    [onSearch],
  );

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  };

  // Ordena pela ordem dos grupos para render e navegação por teclado
  const grouped = groups
    .map((g) => ({ config: g, items: (items ?? []).filter((i) => i.group === g.key) }))
    .filter((g) => g.items.length > 0);
  const flat = grouped.flatMap((g) => g.items);

  const select = (item: SearchResultItem) => {
    onSelect(item);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flat.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, -1));
    }
    if (e.key === "Enter" && selectedIndex >= 0) {
      select(flat[selectedIndex]);
    }
  };

  if (!open) return null;

  let globalIndex = -1; // contador para índice global de seleção

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-background border border-border rounded-lg shadow-popover overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          {loading ? (
            <Loader2 size={18} className="text-muted-foreground shrink-0 animate-spin" />
          ) : (
            <Search size={18} className="text-muted-foreground shrink-0" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setItems(null); }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Resultados */}
        <div className="max-h-[360px] overflow-y-auto">
          {query.length < 2 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Search size={28} className="text-border mb-2" />
              <p className="text-sm text-muted-foreground">Digite pelo menos 2 caracteres para buscar</p>
              {emptyHint && <p className="text-xs text-border mt-1">{emptyHint}</p>}
            </div>
          )}

          {query.length >= 2 && !loading && items !== null && total === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum resultado para <span className="text-foreground">&quot;{query}&quot;</span>
              </p>
            </div>
          )}

          {grouped.map(({ config, items: groupItems }) => (
            <div key={config.key}>
              <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground bg-muted/40 border-b border-border">
                {config.label}
              </div>
              {groupItems.map((item) => {
                globalIndex++;
                const idx = globalIndex;
                const selected = selectedIndex === idx;
                return (
                  <button
                    key={item.id}
                    onClick={() => select(item)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors",
                      selected && "bg-accent",
                    )}
                  >
                    <div
                      className={cn(
                        "p-1.5 rounded-[6px] shrink-0",
                        config.iconClassName ?? "bg-primary/15 text-primary",
                      )}
                    >
                      {config.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{item.title}</p>
                      {item.subtitle && (
                        <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                      )}
                    </div>
                    {item.status && (
                      <span className="text-[10px] text-muted-foreground bg-background border border-border px-1.5 py-0.5 rounded-[4px] shrink-0">
                        {item.status}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border">
          <span className="text-[10px] text-muted-foreground">↑↓ navegar</span>
          <span className="text-[10px] text-muted-foreground">↵ abrir</span>
          <span className="text-[10px] text-muted-foreground">Esc fechar</span>
          {items !== null && (
            <span className="ml-auto text-[10px] text-muted-foreground">
              {total} resultado{total !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
