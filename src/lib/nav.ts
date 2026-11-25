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
  KeyRound,
} from "lucide-react";
import type { StaffRole } from "@contracts/roles";

export interface NavItem {
  title: string;
  path: string;
  icon: LucideIcon;
  phase: string;
  minRole: StaffRole;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Service",
    items: [
      { title: "New Sale", path: "/pos", icon: ShoppingCart, phase: "Phase 1 · Step 5", minRole: "sales" },
      { title: "Orders", path: "/orders", icon: ClipboardList, phase: "Phase 2", minRole: "sales" },
      { title: "Sales History", path: "/sales", icon: History, phase: "Phase 1 · Step 9", minRole: "sales" },
    ],
  },
  {
    label: "Management",
    items: [
      { title: "Menu", path: "/menu", icon: BookOpen, phase: "Phase 1 · Step 4", minRole: "manager" },
      { title: "Customers", path: "/customers", icon: Users, phase: "Phase 2", minRole: "sales" },
      { title: "Money", path: "/money", icon: Wallet, phase: "Phase 3", minRole: "manager" },
      { title: "Staff", path: "/staff", icon: UserCog, phase: "Live", minRole: "admin" },
      { title: "Reports", path: "/reports", icon: BarChart3, phase: "Phase 3", minRole: "manager" },
    ],
  },
  {
    label: "System",
    items: [
      { title: "My Account", path: "/account", icon: KeyRound, phase: "Live", minRole: "sales" },
      { title: "Settings", path: "/settings", icon: Settings, phase: "Phase 4", minRole: "admin" },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
