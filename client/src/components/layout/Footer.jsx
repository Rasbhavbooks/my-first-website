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
  const privacyPage = pages.find((page) => ["privacy", "privacy-policy"].includes(page.slug));
  const termsPage = pages.find((page) => ["terms", "terms-of-service"].includes(page.slug));
  const legalPages = [privacyPage, termsPage].filter(Boolean);
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div><a className="brand brand-light" href="#home"><span className="brand-mark"><BookOpen size={18} /></span><span className="brand-name">{settings.platform?.siteName || "Rasbhav Books"}</span></a><p>{footer.tagline?.[language] || footer.tagline?.en || t.made}</p></div>
        <div className="footer-links"><strong>{t.browse}</strong>{(footer.browseLinks || []).filter((item) => item.enabled).map((item, index) => <Link key={`${item.href}-${index}`} to={item.href}>{item.label?.[language] || item.label?.en}</Link>)}</div>
        <div className="footer-links"><strong>{footer.communityTitle?.[language] || footer.communityTitle?.en || t.community}</strong>{(footer.communityLinks || []).filter((item) => item.enabled).map((item, index) => <Link key={`community-${item.href}-${index}`} to={item.href}>{item.label?.[language] || item.label?.en}</Link>)}<Link to="/community">{{ gu: "પુસ્તક ચર્ચાઓ", hi: "पुस्तक चर्चाएँ", en: "Book discussions" }[language]}</Link><a href={`mailto:${settings.platform?.supportEmail || "hello@rasbhavbooks.com"}`}><Mail size={14} /> {t.supportContact}</a>{pages.filter((page) => !legalPages.some((legalPage) => legalPage.slug === page.slug)).map((page) => <Link key={page.slug} to={`/pages/${encodeURIComponent(page.slug)}`}>{page.title?.[language] || page.title?.en || page.slug}</Link>)}</div>
      </div>
      <div className="footer-bottom"><span>{t.copyright}</span>{legalPages.length > 0 && <nav className="footer-legal-links" aria-label={t.legalLinks}>{legalPages.map((page) => <Link key={page.slug} to={`/pages/${encodeURIComponent(page.slug)}`}>{page.title?.[language] || page.title?.en || page.slug}</Link>)}</nav>}</div>
    </footer>
  );
}
