import { SectionPlaceholder } from "@/components/shell/SectionPlaceholder";

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

export function SettingsPage() {
  return (
    <SectionPlaceholder
      title="Settings"
      phase="Phase 4"
      description="Restaurant profile, receipt layout, printers and devices, bank POS terminal registry, and partner delivery app connections."
    />
  );
}
