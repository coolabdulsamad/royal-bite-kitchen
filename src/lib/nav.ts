import type { LucideIcon } from "lucide-react";
import {
  ShoppingCart,
  ClipboardList,
  History,
  BookOpen,
  Users,
  Wallet,
  UserCog,
  BarChart3,
  Settings,
} from "lucide-react";

export interface NavItem {
  title: string;
  path: string;
  icon: LucideIcon;
  phase: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Service",
    items: [
      { title: "New Sale", path: "/pos", icon: ShoppingCart, phase: "Phase 1 · Step 5" },
      { title: "Orders", path: "/orders", icon: ClipboardList, phase: "Phase 2" },
      { title: "Sales History", path: "/sales", icon: History, phase: "Phase 1 · Step 9" },
    ],
  },
  {
    label: "Management",
    items: [
      { title: "Menu", path: "/menu", icon: BookOpen, phase: "Phase 1 · Step 4" },
      { title: "Customers", path: "/customers", icon: Users, phase: "Phase 2" },
      { title: "Money", path: "/money", icon: Wallet, phase: "Phase 3" },
      { title: "Staff", path: "/staff", icon: UserCog, phase: "Phase 3" },
      { title: "Reports", path: "/reports", icon: BarChart3, phase: "Phase 3" },
    ],
  },
  {
    label: "System",
    items: [{ title: "Settings", path: "/settings", icon: Settings, phase: "Phase 4" }],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
