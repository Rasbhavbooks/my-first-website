import { Navigate, Outlet } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";

export default function AdminMfaGuard() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  if (loading) return <main className="admin-home"><p>{t.loadingAccount}</p></main>;
  if (!user || user.role !== "admin") return <Navigate to="/admin/login" replace />;
  if (!user.adminMfaEnabled) return <Navigate to="/admin/security/mfa" replace />;
  return <Outlet />;
}
