"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import { acoesDoDia, type AtendimentoHoje } from "@/lib/acoes-do-dia";

/**
 * Lista de atendimentos do estúdio. Mesma `queryKey` e mesmo endpoint da
 * página de Atendimentos, então o cache é compartilhado (tela Hoje, menu e
 * lista não geram requisições duplicadas dentro do staleTime).
 */
export function useAtendimentos() {
  return useQuery<AtendimentoHoje[]>({
    queryKey: ["atendimentos"],
    queryFn: () => api.get<AtendimentoHoje[]>("/api/v1/atendimentos/"),
  });
}

/**
 * Quantidade de atendimentos que pedem ação do tatuador (responder, cobrar
 * sinal, confirmar). Alimenta o selo do menu. Zero enquanto carrega.
 */
export function useContagemAcoes(): number {
  const { data } = useAtendimentos();
  return data ? acoesDoDia(data, new Date()).length : 0;
}
