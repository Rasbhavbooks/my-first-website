import { BookOpen, Feather, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { useLanguage } from "../../hooks/useLanguage.js";

const styles = `
.login-portals{min-height:70vh;padding:64px 22px;display:grid;place-items:center;background:radial-gradient(ellipse at 80% 15%,#eee7da 0,transparent 38%),#f8f6f1}
.login-portals-inner{width:min(100%,960px)}
.login-portals h1{font:500 clamp(36px,6vw,54px)/1.08 var(--serif);color:#30252c}
.login-portals-intro{max-width:620px;color:#77716a;font-size:12px;line-height:1.8}
.login-portals-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:15px;margin-top:28px}
.login-portal-card{display:flex;min-height:210px;flex-direction:column;align-items:flex-start;padding:24px;border:1px solid #e4ddd1;background:#fffdfa;color:#30252c;text-decoration:none;transition:transform .2s,border-color .2s}
.login-portal-card:hover{transform:translateY(-3px);border-color:#a8844b}
.login-portal-card svg{color:#987844}.login-portal-card h2{margin:19px 0 7px;font:500 24px var(--serif)}
.login-portal-card p{margin:0;color:#77716a;font-size:11px;line-height:1.7}
.login-portals-footer{margin-top:24px;color:#77716a;font-size:11px}.login-portals-footer a{color:#796747;text-decoration:underline}
`;

export default function LoginPortalPage() {
  const { t } = useLanguage();
  return (
    <main className="login-portals">
      <style>{styles}</style>
      <section className="login-portals-inner">
        <div className="eyebrow"><i />{t.loginPortal}</div>
        <h1>{t.chooseLoginPortal}</h1>
        <p className="login-portals-intro">{t.loginPortalIntro}</p>
        <div className="login-portals-grid">
          <Link className="login-portal-card" to="/reader/login">
            <BookOpen size={23} />
            <h2>{t.readerPortal}</h2>
            <p>{t.readerLoginIntro}</p>
          </Link>
          <Link className="login-portal-card" to="/author/login">
            <Feather size={23} />
            <h2>{t.authorPortal}</h2>
            <p>{t.authorLoginIntro}</p>
          </Link>
        </div>
        <p className="login-portals-footer">{t.newReader} <Link to="/register">{t.createAccount}</Link></p>
      </section>
    </main>
  );
}
