import { Navigate, Route, Routes } from "react-router";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/shell/RequireAuth";
import Login from "@/pages/Login";
import StaffPage from "@/pages/Staff";
import AccountPage from "@/pages/Account";
import MenuPage from "@/pages/Menu";
import PosPage from "@/pages/Pos";
import DisplayPage from "@/pages/Display";
import SalesPage from "@/pages/Sales";
import OrdersPage from "@/pages/Orders";
import MoneyPage from "@/pages/Money";
import {
  CustomersPage,
  ReportsPage,
  SettingsPage,
} from "@/pages/placeholders";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/display" element={<DisplayPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/pos" replace />} />
        <Route path="/pos" element={<PosPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route
          path="/menu"
          element={
            <RequireAuth minRole="manager">
              <MenuPage />
            </RequireAuth>
          }
        />
        <Route
          path="/money"
          element={
            <RequireAuth minRole="manager">
              <MoneyPage />
            </RequireAuth>
          }
        />
        <Route
          path="/reports"
          element={
            <RequireAuth minRole="manager">
              <ReportsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/staff"
          element={
            <RequireAuth minRole="admin">
              <StaffPage />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth minRole="admin">
              <SettingsPage />
            </RequireAuth>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/pos" replace />} />
    </Routes>
  );
}
