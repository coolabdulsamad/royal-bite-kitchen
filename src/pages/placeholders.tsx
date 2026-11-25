import { SectionPlaceholder } from "@/components/shell/SectionPlaceholder";

export function PosPage() {
  return (
    <SectionPlaceholder
      title="New Sale"
      phase="Phase 1 · Step 5"
      description="The cashier screen: touch-friendly menu grid, live cart, split payments across cash, bank POS and transfer, discounts with permission limits, held orders, and instant receipt printing."
    />
  );
}

export function OrdersPage() {
  return (
    <SectionPlaceholder
      title="Orders"
      phase="Phase 2"
      description="Dine-in, takeaway and delivery orders with kitchen tickets and a kitchen display — plus orders arriving automatically from partner apps like Glovo and Chowdeck."
    />
  );
}

export function SalesPage() {
  return (
    <SectionPlaceholder
      title="Sales History"
      phase="Phase 1 · Step 9"
      description="Every sale searchable by date, staff member, payment method or receipt number — with receipt reprinting and returns on finished sales."
    />
  );
}

export function MenuPage() {
  return (
    <SectionPlaceholder
      title="Menu"
      phase="Phase 1 · Step 4"
      description="Categories, items, prices, modifiers like sizes and extras, photos and availability — managed by the manager role and above."
    />
  );
}

export function CustomersPage() {
  return (
    <SectionPlaceholder
      title="Customers"
      phase="Phase 2"
      description="Customer profiles, credit balances and payment history — so regulars and owing customers are always one tap away."
    />
  );
}

export function MoneyPage() {
  return (
    <SectionPlaceholder
      title="Money"
      phase="Phase 3"
      description="Cash drawer sessions, expenses, money in and out, and end-of-day reconciliation so the books always balance."
    />
  );
}

export function StaffPage() {
  return (
    <SectionPlaceholder
      title="Staff"
      phase="Phase 3"
      description="Staff accounts, role permissions, attendance clock-in and clock-out, and a full audit trail of sensitive actions."
    />
  );
}

export function ReportsPage() {
  return (
    <SectionPlaceholder
      title="Reports"
      phase="Phase 3"
      description="Sales analytics and KPI dashboards: revenue trends, top-selling items, peak hours, payment-method breakdown — with AI insights arriving in Phase 4."
    />
  );
}

export function SettingsPage() {
  return (
    <SectionPlaceholder
      title="Settings"
      phase="Phase 4"
      description="Restaurant profile, receipt layout, printers and devices, bank POS terminal registry, and partner delivery app connections."
    />
  );
}
