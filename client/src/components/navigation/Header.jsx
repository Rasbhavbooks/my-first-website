import { useState } from "react";
import { BookOpen, Menu, X } from "lucide-react";
import { useLanguage } from "../../hooks/useLanguage.js";

export default function Header() {
  const { language, setLanguage, t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <a className="brand" href="#home" aria-label="Rasbhav Books home">
        <span className="brand-icon"><BookOpen size={19} /></span>
        <span className="brand-name">rasbhav<span>books</span></span>
      </a>
      <nav className={menuOpen ? "main-nav nav-open" : "main-nav"} aria-label="Main navigation">
        <a href="#discover" onClick={() => setMenuOpen(false)}>{t.discover}</a>
        <a href="#authors" onClick={() => setMenuOpen(false)}>{t.authors}</a>
        <a href="#about" onClick={() => setMenuOpen(false)}>{t.about}</a>
      </nav>
      <div className="header-actions">
        <label className="language-select">
          <span className="sr-only">{t.chooseLanguage}</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="en">EN</option><option value="gu">ગુજ</option><option value="hi">हि</option>
          </select>
        </label>
        <a className="button button-dark header-join" href="#authors">{t.join}</a>
        <button className="mobile-menu" aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}
