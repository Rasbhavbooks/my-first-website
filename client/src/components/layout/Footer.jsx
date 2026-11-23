import { useEffect, useState } from "react";
import { Link } from "react-router";
import { BookOpen, Mail } from "lucide-react";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useSiteContent } from "../../hooks/useSiteContent.js";
import { getPublishedCmsPages } from "../../services/cmsPageService.js";

export default function Footer() {
  const { language, t } = useLanguage();
  const { settings } = useSiteContent();
  const footer = settings.footer || {};
  const [pages, setPages] = useState([]);
  useEffect(() => { getPublishedCmsPages().then(setPages); }, []);
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div><a className="brand brand-light" href="#home"><span className="brand-mark"><BookOpen size={18} /></span><span className="brand-name">{settings.platform?.siteName || "Rasbhav Books"}</span></a><p>{footer.tagline?.[language] || footer.tagline?.en || t.made}</p></div>
        <div className="footer-links"><strong>{t.browse}</strong>{(footer.browseLinks || []).filter((item) => item.enabled).map((item, index) => <Link key={`${item.href}-${index}`} to={item.href}>{item.label?.[language] || item.label?.en}</Link>)}</div>
        <div className="footer-links"><strong>{footer.communityTitle?.[language] || footer.communityTitle?.en || t.community}</strong>{(footer.communityLinks || []).filter((item) => item.enabled).map((item, index) => <Link key={`community-${item.href}-${index}`} to={item.href}>{item.label?.[language] || item.label?.en}</Link>)}<a href={`mailto:${settings.platform?.supportEmail || "hello@rasbhavbooks.com"}`}><Mail size={14} /> {t.supportContact}</a>{pages.map((page) => <Link key={page.slug} to={`/pages/${encodeURIComponent(page.slug)}`}>{page.title?.[language] || page.title?.en || page.slug}</Link>)}</div>
      </div>
      <div className="footer-bottom"><span>{t.copyright}</span><span>Privacy · Terms</span></div>
    </footer>
  );
}
