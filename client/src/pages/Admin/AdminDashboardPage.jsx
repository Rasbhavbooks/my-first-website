import { Link, Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";

const styles = `
.admin-home{max-width:1040px;min-height:70vh;margin:auto;padding:56px 22px 90px}
.admin-home h1{font:500 clamp(36px,5vw,50px)/1.1 var(--serif);color:#30252c}
.admin-home-intro{max-width:680px;color:#77716a;font-size:12px;line-height:1.8}
.admin-home-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:28px}
.admin-home-card{display:flex;min-height:150px;flex-direction:column;justify-content:space-between;padding:22px;border:1px solid #e4ddd1;background:#fffdfa;color:#30252c;text-decoration:none;transition:border-color .2s,transform .2s}
.admin-home-card:hover{border-color:#a8844b;transform:translateY(-2px)}
.admin-home-card strong{font:500 23px/1.2 var(--serif)}
.admin-home-card span{color:#796747;font-size:11px}
`;
export default function AdminDashboardPage() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  if (loading) return <main className="admin-home"><p>{t.loadingAccount}</p></main>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "admin") return <main className="admin-home"><h1>{t.adminOnly}</h1><Link to="/">{t.backHome}</Link></main>;
  const sections = [
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
      <div className="admin-home-grid">
        {sections.map(([label, path]) => <Link className="admin-home-card" key={path} to={path}><strong>{label}</strong><span>{t.openAdminSection} ↗</span></Link>)}
      </div>
    </main>
  );
}
