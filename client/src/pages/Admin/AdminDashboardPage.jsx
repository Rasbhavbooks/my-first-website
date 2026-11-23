import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { getAdminDashboardStats, getAdminPlatformReadiness } from "../../services/adminDashboardService.js";

const styles = `
.admin-home{max-width:1040px;min-height:70vh;margin:auto;padding:56px 22px 90px}
.admin-home h1{font:500 clamp(36px,5vw,50px)/1.1 var(--serif);color:#30252c}
.admin-home-intro{max-width:680px;color:#77716a;font-size:12px;line-height:1.8}
.admin-home-overview{margin-top:26px}
.admin-home-overview h2{font:500 24px var(--serif);color:#30252c}
.admin-home-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:11px}
.admin-home-stat{display:grid;gap:8px;min-height:104px;padding:17px;border:1px solid #e4ddd1;background:#fffdfa}
.admin-home-stat strong{font:500 30px var(--serif);color:#30252c}
.admin-home-stat span{color:#77716a;font-size:10px;line-height:1.5}
.admin-home-error{padding:12px;background:#f8ece8;color:#863d32;font-size:11px}
.admin-readiness-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:11px}
.admin-readiness-card{display:grid;gap:8px;padding:16px;border:1px solid #e4ddd1;background:#fffdfa}
.admin-readiness-card strong{font:500 18px var(--serif);color:#30252c}
.admin-readiness-card p{margin:0;color:#77716a;font-size:10px;line-height:1.7}
.admin-readiness-status{font-size:10px;font-weight:700}
.admin-readiness-status[data-state="configured"],.admin-readiness-status[data-state="connected"]{color:#28724f}
.admin-readiness-status[data-state="missing"]{color:#9b4c35}
.admin-readiness-status[data-state="disabled"]{color:#796747}
.admin-home-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:28px}
.admin-home-card{display:flex;min-height:150px;flex-direction:column;justify-content:space-between;padding:22px;border:1px solid #e4ddd1;background:#fffdfa;color:#30252c;text-decoration:none;transition:border-color .2s,transform .2s}
.admin-home-card:hover{border-color:#a8844b;transform:translateY(-2px)}
.admin-home-card strong{font:500 23px/1.2 var(--serif)}
.admin-home-card span{color:#796747;font-size:11px}
`;
export default function AdminDashboardPage() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState("");
  const [readiness, setReadiness] = useState(null);
  const [readinessError, setReadinessError] = useState("");
  useEffect(() => {
    let active = true;
    if (user?.role !== "admin") return () => { active = false; };
    getAdminDashboardStats()
      .then((result) => { if (active) { setStats(result); setStatsError(""); } })
      .catch(() => { if (active) setStatsError(t.adminDashboardError); });
    return () => { active = false; };
  }, [user?.id, user?.role, t.adminDashboardError]);

  useEffect(() => {
    let active = true;
    if (user?.role !== "admin") return () => { active = false; };
    getAdminPlatformReadiness()
      .then((result) => { if (active) { setReadiness(result); setReadinessError(""); } })
      .catch(() => { if (active) setReadinessError(t.adminReadinessError); });
    return () => { active = false; };
  }, [user?.id, user?.role, t.adminReadinessError]);

  if (loading) return <main className="admin-home"><p>{t.loadingAccount}</p></main>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "admin") return <main className="admin-home"><h1>{t.adminOnly}</h1><Link to="/">{t.backHome}</Link></main>;
  const sections = [
    [t.adminUsersTitle, "/admin/users"],
    [t.adminMfaSetupTitle, "/admin/security/mfa"],
    [t.adminAuditLogTitle, "/admin/audit-log"],
    [t.adminSecuritySessionsTitle, "/admin/security/sessions"],
    [t.adminAuthorsTitle, "/admin/authors"],
    [t.adminCatalogueTitle, "/admin/catalogue"],
    [t.adminCategoriesTitle, "/admin/categories"],
    [t.cmsPagesTitle, "/admin/cms-pages"],
    [t.blogAdminTitle, "/admin/blog"],
    [t.mediaLibraryTitle, "/admin/media"],
    [t.siteSettingsTitle, "/admin/site-settings"],
    [t.authorApplicationsTitle, "/admin/author-applications"],
    [t.adminBookReviewTitle, "/admin/author-books"],
    [t.adminReviewsTitle, "/admin/review-moderation"],
  ];
  return (
    <main className="admin-home">
      <style>{styles}</style>
      <div className="eyebrow"><i />{t.adminPortal}</div>
      <h1>{t.adminDashboardTitle}</h1>
      <p className="admin-home-intro">{t.adminDashboardIntro}</p>
      <section className="admin-home-overview" aria-label={t.adminOverview}>
        <h2>{t.adminOverview}</h2>
        {statsError && <p className="admin-home-error" role="alert">{statsError}</p>}
        {!stats && !statsError && <p>{t.adminDashboardLoading}</p>}
        {stats && <div className="admin-home-stats">
          {[
            [t.adminTotalUsers, stats.totalUsers],
            [t.adminTotalReaders, stats.totalReaders],
            [t.adminTotalAuthors, stats.totalAuthors],
            [t.adminCatalogueBooks, stats.totalCatalogueBooks],
            [t.adminPendingApplications, stats.pendingAuthorApplications],
            [t.adminPendingBooks, stats.pendingBookReviews],
            [t.adminPendingReports, stats.pendingReviewReports],
          ].map(([label, value]) => <div className="admin-home-stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}
        </div>}
      </section>
      <section className="admin-home-overview" aria-label={t.adminReadinessTitle}>
        <h2>{t.adminReadinessTitle}</h2>
        <p className="admin-home-intro">{t.adminReadinessIntro}</p>
        {readinessError && <p className="admin-home-error" role="alert">{readinessError}</p>}
        {!readiness && !readinessError && <p>{t.adminDashboardLoading}</p>}
        {readiness && <div className="admin-readiness-grid">
          {[
            ["databaseConnected", t.adminReadinessDatabase, t.adminReadinessDatabaseHint, "connected"],
            ["emailConfigured", t.adminReadinessEmail, t.adminReadinessEmailHint, "configured"],
            ["adminMfaKeyConfigured", t.adminReadinessMfa, t.adminReadinessMfaHint, "configured"],
            ["r2CredentialsConfigured", t.adminReadinessStorage, t.adminReadinessStorageHint, "configured"],
            ["clamavHostConfigured", t.adminReadinessScannerConfig, t.adminReadinessScannerConfigHint, "configured"],
            ["clamavReachable", t.adminReadinessScanner, t.adminReadinessScannerHint, "connected"],
            ["publishingEnabled", t.adminReadinessPublishing, t.adminReadinessPublishingHint, "configured"],
          ].map(([key, label, hint, configuredState]) => {
            const enabled = readiness[key];
            const state = key === "publishingEnabled" && !enabled ? "disabled" : enabled ? configuredState : "missing";
            const stateLabel = state === "disabled" ? t.adminReadinessDisabled : state === "missing" ? t.adminReadinessMissing : state === "connected" ? t.adminReadinessConnected : t.adminReadinessConfigured;
            return <article className="admin-readiness-card" key={key}>
              <strong>{label}</strong><span className="admin-readiness-status" data-state={state}>{stateLabel}</span><p>{hint}</p>
            </article>;
          })}
        </div>}
      </section>
      <div className="admin-home-grid">
        {sections.map(([label, path]) => <Link className="admin-home-card" key={path} to={path}><strong>{label}</strong><span>{t.openAdminSection} ↗</span></Link>)}
      </div>
    </main>
  );
}
