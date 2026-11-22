import type { LucideIcon } from "lucide-react";
import {
  BarChart2,
  Calendar,
  ClipboardList,
  FileText,
  Image,
  MoreHorizontal,
  Package,
  Settings,
  Sun,
  Users,
  Wallet,
  Zap,
} from "lucide-react";

import type { TipoUsuario } from "@/lib/auth/useRole";

/**
 * Grupos do menu lateral, na ordem de uso no dia a dia do tatuador:
 * operação (o que acontece hoje), vitrine (o que o cliente vê) e gestão
 * (o que se consulta de vez em quando).
 */
export type NavGroup = "operacao" | "vitrine" | "gestao";

export const NAV_GROUP_LABEL: Record<NavGroup, string> = {
  operacao: "Operação",
  vitrine: "Vitrine",
  gestao: "Gestão",
};

export const NAV_GROUP_ORDER: NavGroup[] = ["operacao", "vitrine", "gestao"];

export type AppNavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  mobile: "tab" | "more" | "hidden";
  group: NavGroup;
  badge?: string;
  /**
   * Papéis que podem ver este item (espelha o RBAC do backend). Ausente =
   * visível a todos os usuários logados.
   */
  roles?: TipoUsuario[];
};

/**
 * Ordenado por frequência de uso: Hoje, Agenda, Atendimentos e Clientes são
 * consultados todo dia (e são as abas do celular); Financeiro vem logo depois;
 * vitrine e gestão ficam mais abaixo.
 */
export const APP_NAV_ITEMS: AppNavItem[] = [
  {
    href: "/",
    label: "Hoje",
    shortLabel: "Hoje",
    icon: Sun,
    mobile: "tab",
    group: "operacao",
  },
  {
    href: "/agenda",
    label: "Agenda",
    shortLabel: "Agenda",
    icon: Calendar,
    mobile: "tab",
    group: "operacao",
  },
  {
    href: "/atendimentos",
    label: "Atendimentos",
    shortLabel: "Atend.",
    icon: ClipboardList,
    mobile: "tab",
    group: "operacao",
  },
  {
    href: "/clientes",
    label: "Clientes",
    shortLabel: "Clientes",
    icon: Users,
    mobile: "tab",
    group: "operacao",
  },
  {
    href: "/financeiro",
    label: "Financeiro",
    shortLabel: "Finanças",
    icon: Wallet,
    mobile: "more",
    group: "operacao",
    roles: ["ADMIN"],
  },
  {
    href: "/portfolio",
    label: "Portfólio",
    shortLabel: "Portfólio",
    icon: Image,
    mobile: "more",
    group: "vitrine",
  },
  {
    href: "/flash-arts",
    label: "Flash Arts",
    shortLabel: "Flash",
    icon: Zap,
    mobile: "more",
    group: "vitrine",
  },
  {
    href: "/documentos",
    label: "Documentos",
    shortLabel: "Docs",
    icon: FileText,
    mobile: "more",
    group: "gestao",
  },
  {
    href: "/estoque",
    label: "Estoque",
    shortLabel: "Estoque",
    icon: Package,
    mobile: "more",
    group: "gestao",
  },
  {
    href: "/relatorios",
    label: "Relatórios",
    shortLabel: "Relatórios",
    icon: BarChart2,
    mobile: "more",
    group: "gestao",
    roles: ["ADMIN"],
  },
  {
    href: "/configuracoes",
    label: "Configurações",
    shortLabel: "Config.",
    icon: Settings,
    mobile: "more",
    group: "gestao",
  },
];

export const MOBILE_TAB_ITEMS = APP_NAV_ITEMS.filter(
  (item) => item.mobile === "tab",
);

export const MOBILE_MORE_ITEMS = APP_NAV_ITEMS.filter(
  (item) => item.mobile === "more",
);

export const DESKTOP_NAV_ITEMS = APP_NAV_ITEMS.filter(
  (item) => item.href !== "/configuracoes",
);

export const MOBILE_MORE_TAB_ITEM: AppNavItem = {
  href: "/mais",
  label: "Mais",
  shortLabel: "Mais",
  icon: MoreHorizontal,
  mobile: "tab",
  group: "gestao",
};

/**
 * Filtra itens de navegação pelo papel do usuário, espelhando o RBAC do
 * backend. Itens sem `roles` são visíveis a todos. Enquanto o papel ainda não
 * carregou (`tipo` indefinido), itens restritos ficam ocultos para evitar um
 * flash do menu seguido de 403 silencioso.
 */
export function filterNavByRole<T extends AppNavItem>(
  items: T[],
  tipo: TipoUsuario | undefined,
): T[] {
  return items.filter((item) => !item.roles || (tipo ? item.roles.includes(tipo) : false));
}
