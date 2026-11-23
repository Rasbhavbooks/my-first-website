import { useState } from "react";
import { BookOpen, Menu, X } from "lucide-react";
import { Link } from "react-router";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useWishlist } from "../../context/WishlistContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useSiteContent } from "../../hooks/useSiteContent.js";

export default function Header() {
  const { language, setLanguage, t } = useLanguage();
  const { savedBookIds } = useWishlist();
  const { user, loading } = useAuth();
  const { settings } = useSiteContent();
  const navigation = (settings.navigation || []).filter((item) => item.enabled);
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <a className="brand" href="#home" aria-label={`${settings.platform?.siteName || "Rasbhav Books"} home`}>
        <span className="brand-mark"><BookOpen size={19} /></span><span className="brand-name">{settings.platform?.siteName || "Rasbhav Books"}</span>
      </a>
      <nav className={open ? "main-nav is-open" : "main-nav"} aria-label="Main navigation">
        {navigation.map((item, index) => <Link key={`${item.href}-${index}`} to={item.href} onClick={() => setOpen(false)}>{item.label?.[language] || item.label?.en}</Link>)}
        <Link to="/wishlist" onClick={() => setOpen(false)}>{t.wishlist}{savedBookIds.length > 0 && <span className="wishlist-count">{savedBookIds.length}</span>}</Link>
        {!loading && (user
          ? <Link to="/account" onClick={() => setOpen(false)}>{t.accountPage}</Link>
          : <><Link to="/login" onClick={() => setOpen(false)}>{t.signIn}</Link><Link to="/register" onClick={() => setOpen(false)}>{t.createAccount}</Link></>)}
      </nav>
      <div className="header-actions">
        <label className="language-select"><span className="sr-only">{t.language}</span><select value={language} onChange={(event) => setLanguage(event.target.value)}><option value="en">EN</option><option value="gu">ગુજ</option><option value="hi">हि</option></select></label>
        <a className="button button-dark header-join" href="#authors">{t.join}</a>
        <button className="mobile-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
      </div>
    </header>
  );
}
