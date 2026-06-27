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
  Users,
  Wallet,
  Zap,
} from "lucide-react";

import type { TipoUsuario } from "@/lib/auth/useRole";

export type AppNavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  mobile: "tab" | "more" | "hidden";
  badge?: string;
  /**
   * Papéis que podem ver este item (espelha o RBAC do backend). Ausente =
   * visível a todos os usuários logados.
   */
  roles?: TipoUsuario[];
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  {
    href: "/",
    label: "Início",
    shortLabel: "Início",
    icon: BarChart2,
    mobile: "tab",
  },
  {
    href: "/agenda",
    label: "Agenda",
    shortLabel: "Agenda",
    icon: Calendar,
    mobile: "tab",
  },
  {
    href: "/atendimentos",
    label: "Atendimentos",
    shortLabel: "Atend.",
    icon: ClipboardList,
    mobile: "tab",
  },
  {
    href: "/clientes",
    label: "Clientes",
    shortLabel: "Clientes",
    icon: Users,
    mobile: "tab",
  },
  {
    href: "/portfolio",
    label: "Portfólio",
    shortLabel: "Portfólio",
    icon: Image,
    mobile: "more",
  },
  {
    href: "/flash-arts",
    label: "Flash Arts",
    shortLabel: "Flash",
    icon: Zap,
    mobile: "more",
  },
  {
    href: "/financeiro",
    label: "Financeiro",
    shortLabel: "Finanças",
    icon: Wallet,
    mobile: "more",
    roles: ["ADMIN"],
  },
  {
    href: "/estoque",
    label: "Estoque",
    shortLabel: "Estoque",
    icon: Package,
    mobile: "more",
  },
  {
    href: "/documentos",
    label: "Documentos",
    shortLabel: "Docs",
    icon: FileText,
    mobile: "more",
  },
  {
    href: "/relatorios",
    label: "Relatórios",
    shortLabel: "Relatórios",
    icon: BarChart2,
    mobile: "more",
    roles: ["ADMIN"],
  },
  {
    href: "/configuracoes",
    label: "Configurações",
    shortLabel: "Config.",
    icon: Settings,
    mobile: "more",
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
