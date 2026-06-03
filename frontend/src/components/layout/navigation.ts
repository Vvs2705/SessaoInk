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

export type AppNavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  mobile: "tab" | "more" | "hidden";
  badge?: string;
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
    badge: "Em breve",
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
