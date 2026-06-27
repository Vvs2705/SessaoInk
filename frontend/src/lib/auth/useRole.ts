"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import type { Usuario } from "@/lib/auth/types";

/**
 * Papéis de usuário — espelham o backend (`require_role`):
 * ADMIN / ARTISTA / RECEPCIONISTA.
 */
export type TipoUsuario = Usuario["tipo"];

/**
 * Hook de RBAC do frontend. Lê `GET /api/v1/auth/me` reaproveitando a queryKey
 * `["auth-me"]` já usada em dashboard/financeiro (cache compartilhado, sem
 * requisição duplicada) e expõe o papel do usuário para filtrar menu/guardar
 * páginas, espelhando o RBAC do backend.
 */
export function useRole() {
  const { data: usuario, isLoading } = useQuery<Usuario>({
    queryKey: ["auth-me"],
    queryFn: () => api.get<Usuario>("/api/v1/auth/me"),
  });

  const tipo = usuario?.tipo;

  return {
    usuario,
    tipo,
    isAdmin: tipo === "ADMIN",
    isArtista: tipo === "ARTISTA",
    isRecepcionista: tipo === "RECEPCIONISTA",
    isLoading,
  };
}
