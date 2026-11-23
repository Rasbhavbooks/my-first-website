import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { getAdminAuditEvents } from "../../services/adminAuditService.js";

const styles = `
.admin-audit{max-width:1100px;min-height:70vh;margin:auto;padding:54px 22px 90px}
.admin-audit h1{font:500 clamp(34px,5vw,48px)/1.1 var(--serif);color:#30252c}
.admin-audit-intro{max-width:760px;color:#77716a;font-size:11px;line-height:1.8}
.admin-audit-table-wrap{overflow-x:auto;margin:22px 0;border:1px solid #e4ddd1;background:#fffdfa}
.admin-audit-table{width:100%;border-collapse:collapse;text-align:left;font-size:10px}
.admin-audit-table th,.admin-audit-table td{padding:12px;border-bottom:1px solid #e4ddd1;vertical-align:top}
.admin-audit-table th{color:#796747;font-weight:700}
.admin-audit-path{overflow-wrap:anywhere}
.admin-audit-actions{display:flex;align-items:center;gap:12px;margin-top:18px}
.admin-audit-actions button{min-height:38px;padding:0 12px;border:1px solid #d8d0c4;background:#fffdfa;color:#30252c;cursor:pointer}
.admin-audit-actions button:disabled{opacity:.5;cursor:not-allowed}
.admin-audit-error{padding:12px;background:#f8ece8;color:#863d32;font-size:11px}
.admin-audit-empty{padding:18px;border:1px solid #e4ddd1;background:#fffdfa;color:#77716a;font-size:11px}
`;

function formatTimestamp(value, language) {
  const locale = { en: "en-IN", gu: "gu-IN", hi: "hi-IN" }[language] || "en-IN";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function AdminAuditLogPage() {
  const { user, loading } = useAuth();
  const { t, language } = useLanguage();
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(1);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (user?.role !== "admin") return () => { active = false; };
    setLoadingEvents(true);
    getAdminAuditEvents({ page })
      .then((value) => { if (active) { setResult(value); setError(""); } })
      .catch(() => { if (active) setError(t.adminAuditLogError); })
      .finally(() => { if (active) setLoadingEvents(false); });
    return () => { active = false; };
  }, [user?.id, user?.role, page, t.adminAuditLogError]);

  if (loading) return <main className="admin-audit"><p>{t.loadingAccount}</p></main>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "admin") return <main className="admin-audit"><h1>{t.adminOnly}</h1><Link to="/">{t.backHome}</Link></main>;

  const events = result?.events || [];
  const totalPages = result?.totalPages || 1;
  return (
    <main className="admin-audit">
      <style>{styles}</style>
      <div className="eyebrow"><i />{t.adminPortal}</div>
      <h1>{t.adminAuditLogTitle}</h1>
      <p className="admin-audit-intro">{t.adminAuditLogIntro}</p>
      <p><Link to="/admin">{t.adminDashboardTitle}</Link></p>
      {error && <p className="admin-audit-error" role="alert">{error}</p>}
      {loadingEvents && <p role="status">{t.adminAuditLogLoading}</p>}
      {!loadingEvents && !error && events.length === 0 && <p className="admin-audit-empty">{t.adminAuditLogEmpty}</p>}
      {!error && events.length > 0 && <div className="admin-audit-table-wrap">
        <table className="admin-audit-table">
          <thead><tr>
            <th scope="col">{t.adminAuditTime}</th>
            <th scope="col">{t.adminAuditActor}</th>
            <th scope="col">{t.adminAuditAction}</th>
            <th scope="col">{t.adminAuditStatus}</th>
          </tr></thead>
          <tbody>{events.map((event, index) => <tr key={`${event.actorId}-${event.occurredAt}-${index}`}>
            <td>{formatTimestamp(event.occurredAt, language)}</td>
            <td><code>{event.actorId}</code></td>
            <td className="admin-audit-path"><code>{event.method} {event.path}</code></td>
            <td>{event.statusCode}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      {result && totalPages > 1 && <div className="admin-audit-actions">
        <button type="button" disabled={page <= 1 || loadingEvents} onClick={() => setPage((value) => Math.max(1, value - 1))}>{t.previousPage}</button>
        <span>{t.adminUserPage} {page} / {totalPages} · {result.total}</span>
        <button type="button" disabled={page >= totalPages || loadingEvents} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>{t.nextPage}</button>
      </div>}
    </main>
  );
}
