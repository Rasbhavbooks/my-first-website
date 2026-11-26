import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { getAdminLoginSecurityMetrics, getAdminSecuritySessions } from "../../services/adminSecurityService.js";

const styles = `
.admin-security{max-width:1100px;min-height:70vh;margin:auto;padding:54px 22px 90px}
.admin-security h1{font:500 clamp(34px,5vw,48px)/1.1 var(--serif);color:#30252c}
.admin-security-intro{max-width:760px;color:#77716a;font-size:11px;line-height:1.8}
.admin-security-table-wrap{overflow-x:auto;margin:22px 0;border:1px solid #e4ddd1;background:#fffdfa}
.admin-security-table{width:100%;border-collapse:collapse;text-align:left;font-size:10px}
.admin-security-table th,.admin-security-table td{padding:12px;border-bottom:1px solid #e4ddd1;vertical-align:top}
.admin-security-table th{color:#796747;font-weight:700}
.admin-security-id{overflow-wrap:anywhere}
.admin-security-current{color:#316342;font-weight:700}
.admin-security-other{color:#77716a}
.admin-security-error{padding:12px;background:#f8ece8;color:#863d32;font-size:11px}
.admin-security-empty{padding:18px;border:1px solid #e4ddd1;background:#fffdfa;color:#77716a;font-size:11px}\n.admin-security-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:18px 0}.admin-security-metric{padding:16px;border:1px solid #e4ddd1;background:#fffdfa}.admin-security-metric strong{display:block;font:500 24px var(--serif);color:#30252c}.admin-security-metric span{font-size:10px;color:#77716a}\n@media(max-width:600px){.admin-security-metrics{grid-template-columns:1fr}}
`;

function formatTimestamp(value, language) {
  const locale = { en: "en-IN", gu: "gu-IN", hi: "hi-IN" }[language] || "en-IN";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function AdminSecuritySessionsPage() {
  const { user, loading } = useAuth();
  const { t, language } = useLanguage();
  const [result, setResult] = useState(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [metricsError, setMetricsError] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (user?.role !== "admin") return () => { active = false; };
    setLoadingSessions(true);
    getAdminSecuritySessions()
      .then((value) => { if (active) { setResult(value); setError(""); } })
      .catch(() => { if (active) setError(t.adminSecuritySessionsError); })
      .finally(() => { if (active) setLoadingSessions(false); });
    setLoadingMetrics(true);
    getAdminLoginSecurityMetrics()
      .then((value) => { if (active) { setMetrics(value); setMetricsError(""); } })
      .catch(() => { if (active) setMetricsError(t.adminLoginMetricsError); })
      .finally(() => { if (active) setLoadingMetrics(false); });
    return () => { active = false; };
  }, [user?.id, user?.role, t.adminSecuritySessionsError, t.adminLoginMetricsError]);

  if (loading) return <main className="admin-security"><p>{t.loadingAccount}</p></main>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "admin") return <main className="admin-security"><h1>{t.adminOnly}</h1><Link to="/">{t.backHome}</Link></main>;

  const sessions = result?.sessions || [];
  return (
    <main className="admin-security">
      <style>{styles}</style>
      <div className="eyebrow"><i />{t.adminPortal}</div>
      <h1>{t.adminSecuritySessionsTitle}</h1>
      <p className="admin-security-intro">{t.adminSecuritySessionsIntro}</p>
      <p><Link to="/admin">{t.adminDashboardTitle}</Link></p>
      <h2>{t.adminLoginMetricsTitle}</h2>
      <p className="admin-security-intro">{t.adminLoginMetricsIntro}</p>
      {metricsError && <p className="admin-security-error" role="alert">{metricsError}</p>}
      {loadingMetrics && <p role="status">{t.adminLoginMetricsLoading}</p>}
      {!loadingMetrics && metrics && <div className="admin-security-metrics">
        <div className="admin-security-metric"><strong>{metrics.totals.loginSuccesses}</strong><span>{t.adminLoginSuccesses}</span></div>
        <div className="admin-security-metric"><strong>{metrics.totals.loginFailures}</strong><span>{t.adminLoginFailures}</span></div>
        <div className="admin-security-metric"><strong>{metrics.totals.knownAccountFailures}</strong><span>{t.adminKnownAccountFailures}</span></div>
      </div>}
      {!loadingMetrics && metrics?.buckets?.length > 0 && <div className="admin-security-table-wrap">
        <table className="admin-security-table">
          <thead><tr>
            <th scope="col">{t.adminLoginHour}</th>
            <th scope="col">{t.adminLoginSuccesses}</th>
            <th scope="col">{t.adminLoginFailures}</th>
            <th scope="col">{t.adminKnownAccountFailures}</th>
          </tr></thead>
          <tbody>{metrics.buckets.map((bucket) => (
            <tr key={bucket.hour}>
              <td>{formatTimestamp(bucket.hour, language)}</td>
              <td>{bucket.loginSuccesses}</td>
              <td>{bucket.loginFailures}</td>
              <td>{bucket.knownAccountFailures}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>}
      {error && <p className="admin-security-error" role="alert">{error}</p>}
      <h2>{t.adminSecuritySessionsTitle}</h2>
      {loadingSessions && <p role="status">{t.adminSecuritySessionsLoading}</p>}
      {!loadingSessions && !error && sessions.length === 0 && <p className="admin-security-empty">{t.adminSecuritySessionsEmpty}</p>}
      {!error && sessions.length > 0 && <div className="admin-security-table-wrap">
        <table className="admin-security-table">
          <thead><tr>
            <th scope="col">{t.adminSecuritySessionAccount}</th>
            <th scope="col">{t.adminSecuritySessionId}</th>
            <th scope="col">{t.adminSecuritySessionStarted}</th>
            <th scope="col">{t.adminSecuritySessionExpires}</th>
            <th scope="col">{t.adminSecuritySessionStatus}</th>
          </tr></thead>
          <tbody>{sessions.map((session) => (
            <tr key={session.id}>
              <td>{session.displayName || "—"}</td>
              <td className="admin-security-id"><code>{session.actorId}</code></td>
              <td>{formatTimestamp(session.createdAt, language)}</td>
              <td>{formatTimestamp(session.expiresAt, language)}</td>
              <td className={session.current ? "admin-security-current" : "admin-security-other"}>
                {session.current ? t.adminSecuritySessionCurrent : t.adminSecuritySessionOther}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>}
      {result?.hasMore && <p className="admin-security-intro">{t.adminSecuritySessionsMore}</p>}
    </main>
  );
}
