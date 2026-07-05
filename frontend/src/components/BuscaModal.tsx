"use client";

import { useCallback } from "react";
import { ClipboardList, User, Zap } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  SearchModal,
  type SearchGroupConfig,
  type SearchResultItem,
} from "@/components/ui/search-modal";
import { api } from "@/lib/api/client";

/** Shape real do GET /api/v1/busca/ (campos em pt-BR). */
interface ItemBusca {
  id: string;
  titulo: string;
  subtitulo?: string;
  status?: string;
}

interface BuscaResponse {
  q: string;
  total: number;
  clientes: ItemBusca[];
  atendimentos: ItemBusca[];
  flash_arts: ItemBusca[];
}

// Config SessãoInk sobre o SearchModal genérico (@vstack registry):
// grupos, ícones/cores e rota de destino por tipo.
const GRUPOS: SearchGroupConfig[] = [
  { key: "cliente", label: "Clientes", icon: <User size={13} />, iconClassName: "bg-teal-ink/15 text-teal-ink" },
  { key: "atendimento", label: "Atendimentos", icon: <ClipboardList size={13} />, iconClassName: "bg-copper-needle/15 text-copper-needle" },
  { key: "flash_art", label: "Flash Arts", icon: <Zap size={13} />, iconClassName: "bg-text-subtle/15 text-text-subtle" },
];

const GRUPO_HREF: Record<string, string> = {
  cliente: "/clientes",
  atendimento: "/atendimentos",
  flash_art: "/flash-arts",
};

export function BuscaModal({
  aberto,
  onFechar,
}: {
  aberto: boolean;
  onFechar: () => void;
}) {
  const router = useRouter();

  const buscar = useCallback(async (q: string) => {
    const data = await api.get<BuscaResponse>(
      `/api/v1/busca/?q=${encodeURIComponent(q)}&limite=5`,
    );
    // Backend fala titulo/subtitulo → contrato title/subtitle do SearchModal
    const mapear = (itens: ItemBusca[], group: string): SearchResultItem[] =>
      itens.map(({ id, titulo, subtitulo, status }) => ({
        id,
        group,
        title: titulo,
        subtitle: subtitulo,
        status,
      }));
    return {
      items: [
        ...mapear(data.clientes, "cliente"),
        ...mapear(data.atendimentos, "atendimento"),
        ...mapear(data.flash_arts, "flash_art"),
      ],
      total: data.total,
    };
  }, []);

  return (
    <SearchModal
      open={aberto}
      onClose={onFechar}
      onSearch={buscar}
      groups={GRUPOS}
      onSelect={(item) => router.push(`${GRUPO_HREF[item.group]}?destaque=${item.id}`)}
      placeholder="Buscar clientes, atendimentos, flash arts…"
      emptyHint="Clientes · Atendimentos · Flash Arts"
    />
  );
}
