import { Outlet, useLocation } from "react-router";
import Footer from "../components/layout/Footer.jsx";
import Header from "../components/layout/Header.jsx";
import AnnouncementBanner from "../components/layout/AnnouncementBanner.jsx";
import { useLanguage } from "../hooks/useLanguage.js";
import { useSiteContent } from "../hooks/useSiteContent.js";

const maintenanceStyles = `
.maintenance-page{min-height:100vh;display:grid;place-items:center;padding:28px;background:#f6f3ee;color:#30252c;text-align:center}
.maintenance-page__card{max-width:620px;padding:clamp(28px,7vw,64px);border:1px solid #e4ddd1;background:#fffdfa}
.maintenance-page__brand{color:#796747;font-size:11px;letter-spacing:.18em;text-transform:uppercase}
.maintenance-page h1{margin:22px 0 12px;font:500 clamp(32px,7vw,52px)/1.12 var(--serif)}
.maintenance-page p{color:#77716a;font-size:14px;line-height:1.9}
`;

export default function PublicLayout() {
  const { settings } = useSiteContent();
  const { language, t } = useLanguage();
  const location = useLocation();
  const isAdminPath = location.pathname === "/admin" || location.pathname.startsWith("/admin/");

  if (settings.maintenance?.enabled && !isAdminPath) {
    const message = settings.maintenance.message?.[language] || settings.maintenance.message?.en;
    return <main className="maintenance-page"><style>{maintenanceStyles}</style><section className="maintenance-page__card" role="status">
      <span className="maintenance-page__brand">Rasbhav Books</span>
      <h1>{t.maintenancePageTitle}</h1>
      <p>{message}</p>
    </section></main>;
  }

  return <div id="home" className="app"><AnnouncementBanner /><Header /><Outlet /><Footer /></div>;
}
