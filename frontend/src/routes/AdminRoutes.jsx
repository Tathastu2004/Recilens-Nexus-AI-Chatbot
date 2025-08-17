import { Routes, Route } from "react-router-dom";
import AdminLayout from "@/layout/AdminLayout";
import Dashboard from "../pages/admin/Dashboard";
import SystemSetup from "../pages/admin/SystemSetup";
import Analytics from "../pages/admin/Analytics";
import ModelManagement from "@/pages/admin/ModelMangement";
import Users from "../pages/admin/Users";

export default function AdminRoutes() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="system-setup" element={<SystemSetup />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="models" element={<ModelManagement />} />
        <Route path="users" element={<Users />} />
      </Route>
    </Routes>
  );
}
