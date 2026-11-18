import { BookOpen, Instagram, Mail } from "lucide-react";
import { useLanguage } from "../../hooks/useLanguage.js";

export default function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand-block">
          <a className="brand brand-light" href="#home">
            <span className="brand-icon"><BookOpen size={19} /></span>
            <span className="brand-name">rasbhav<span>books</span></span>
          </a>
          <p>{t.made}</p>
        </div>
        <div className="footer-links">
          <strong>{t.browse}</strong><a href="#discover">{t.discover}</a><a href="#languages">{t.languages}</a><a href="#authors">{t.authors}</a>
        </div>
        <div className="footer-links">
          <strong>{t.community}</strong><a href="#about">{t.about}</a><a href="mailto:hello@rasbhavbooks.com"><Mail size={14} /> Email</a><a href="#home"><Instagram size={14} /> Instagram</a>
        </div>
      </div>
      <div className="footer-bottom"><span>{t.copyright}</span><span>Privacy · Terms</span></div>
    </footer>
  );
}
