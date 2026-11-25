import { Navigate, Route, Routes } from "react-router";
import { AppShell } from "@/components/shell/AppShell";
import Login from "@/pages/Login";
import {
  PosPage,
  OrdersPage,
  SalesPage,
  MenuPage,
  CustomersPage,
  MoneyPage,
  StaffPage,
  ReportsPage,
  SettingsPage,
} from "@/pages/placeholders";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/pos" replace />} />
        <Route path="/pos" element={<PosPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/money" element={<MoneyPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/pos" replace />} />
    </Routes>
  );
}
