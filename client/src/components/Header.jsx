import { useState } from "react";
import { BookOpen, Menu, Search, X } from "lucide-react";

export default function Header({ language, setLanguage, t }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <a className="brand" href="#home" aria-label="Rasbhav Books home">
        <span className="brand-icon"><BookOpen size={19}/></span>
        <span className="brand-name">rasbhav<span>books</span></span>
      </a>
      <nav className={open ? "main-nav nav-open" : "main-nav"} aria-label="Main navigation">
        <a href="#discover" onClick={() => setOpen(false)}>{t.discover}</a>
        <a href="#authors" onClick={() => setOpen(false)}>{t.authors}</a>
        <a href="#about" onClick={() => setOpen(false)}>{t.about}</a>
      </nav>
      <div className="header-actions">
        <label className="language-select"><span className="sr-only">Choose language</span><select value={language} onChange={(e) => setLanguage(e.target.value)}><option value="en">EN</option><option value="gu">ગુજ</option><option value="hi">हि</option></select></label>
        <button className="signin-link">{t.signIn}</button>
        <a className="button button-dark header-join" href="#authors">{t.join}</a>
        <button className="mobile-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}>{open ? <X/> : <Menu/>}</button>
      </div>
    </header>
  );
}
