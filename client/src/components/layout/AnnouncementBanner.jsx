import { useLanguage } from "../../hooks/useLanguage.js";
import { useSiteContent } from "../../hooks/useSiteContent.js";

const styles = `
.site-announcement{display:flex;justify-content:center;align-items:center;gap:12px;padding:10px 20px;background:#30252c;color:#fff;font-size:11px;line-height:1.5;text-align:center}
.site-announcement a{color:#f3dfab;text-decoration:underline}
@media(max-width:600px){.site-announcement{flex-wrap:wrap;gap:6px}}
`;

export default function AnnouncementBanner() {
  const { language } = useLanguage();
  const { settings } = useSiteContent();
  const announcement = settings.announcement;
  if (!announcement?.enabled) return null;
  const text = announcement.text?.[language] || announcement.text?.en;
  if (!text) return null;
  const linkLabel = announcement.linkLabel?.[language] || announcement.linkLabel?.en;
  return (
    <>
      <style>{styles}</style>
      <aside className="site-announcement" role="region" aria-label="Announcement">
        <span>{text}</span>
        {announcement.href && linkLabel && <a href={announcement.href}>{linkLabel} ↗</a>}
      </aside>
    </>
  );
}
