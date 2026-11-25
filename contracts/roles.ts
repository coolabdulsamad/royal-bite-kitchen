// Shared staff role definitions — imported by the API (db schema, guards)
// and the frontend (nav gating, role badges) so both sides agree exactly.

export const STAFF_ROLES = [
  "sales",
  "ordering-sales",
  "manager",
  "admin",
  "superadmin",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const ROLE_LEVEL: Record<StaffRole, number> = {
  sales: 1,
  "ordering-sales": 2,
  manager: 3,
  admin: 4,
  superadmin: 5,
};

export const ROLE_LABEL: Record<StaffRole, string> = {
  sales: "Cashier",
  "ordering-sales": "Ordering",
  manager: "Manager",
  admin: "Admin",
  superadmin: "Super Admin",
};

export function roleAtLeast(role: StaffRole, min: StaffRole): boolean {
  return ROLE_LEVEL[role] >= ROLE_LEVEL[min];
}
