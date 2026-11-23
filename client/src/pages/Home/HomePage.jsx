import { Fragment, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, ArrowUpRight, BookOpen, Check, Search, Sparkles, Users } from "lucide-react";
import BookCard from "../../components/books/BookCard.jsx";
import { useCategories } from "../../hooks/useCategories.js";
import { useBooks, useFilteredBooks } from "../../hooks/useBooks.js";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useSiteContent } from "../../hooks/useSiteContent.js";
import { defaultSiteContent } from "../../../../shared/site-content.js";

export default function HomePage() {
  const { language, setLanguage, t } = useLanguage();
  const { settings } = useSiteContent();
  const books = useBooks();
  const { categories, getCategoryLabel } = useCategories();
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const visibleBooks = useFilteredBooks(books, { category, query, language });
  const hero = settings.homepage?.hero || {};
  const heroText = (field, fallback) => hero[field]?.[language] || hero[field]?.en || fallback;
  const sections = Array.isArray(settings.homepage?.sections)
    ? settings.homepage.sections
    : defaultSiteContent.homepage.sections;

  const sectionContent = {
    hero: (
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><i />{heroText("eyebrow", t.eyebrow)}</div>
          <h1>{heroText("title", t.headline)}</h1>
          <p>{heroText("description", t.intro)}</p>
          <div className="hero-actions">
            <a className="button button-dark" href="#discover">{heroText("primaryCta", t.explore)}<ArrowRight size={17} /></a>
            <Link className="button button-light" to="/author/apply">{heroText("secondaryCta", t.authorCta)}<ArrowUpRight size={16} /></Link>
          </div>
          <div className="hero-note"><span>✳</span>{t.note}</div>
        </div>
        <div className="hero-art" aria-label="A stack of books">
          <div className="sun-disc" />
          <div className="hero-caption">THE READING ROOM<br />01 — 03</div>
          <div className="art-leaf">✳</div>
          <div className="display-book book-one"><span>STORIES<br />TO KEEP</span></div>
          <div className="display-book book-two"><span>WORDS<br />THAT STAY</span></div>
          <div className="display-book book-three"><span>RASBHAV<br />BOOKS</span></div>
        </div>
      </section>
    ),
    trust: (
      <section className="trust-row">
        <span><Sparkles size={16} /> Independent authors</span><i />
        <span><BookOpen size={16} /> Stories in three languages</span><i />
        <span><Users size={16} /> Made for readers</span>
      </section>
    ),
    discovery: (
      <section className="section" id="discover">
        <div className="section-head">
          <div className="eyebrow"><i />{t.curated}</div><h2>{t.picks}</h2>
          <a href="#discover" className="text-link">{t.viewAll}<ArrowUpRight size={16} /></a>
        </div>
        <div className="catalog-tools">
          <label className="search"><Search size={17} /><span className="sr-only">{t.search}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} /></label>
          <div className="category-list" id="categories" aria-label={t.filter}>
            {categories.map(({ key }) => <button key={key} className={category === key ? "category active" : "category"} onClick={() => setCategory(key)}>{getCategoryLabel(key)}</button>)}
          </div>
        </div>
        {visibleBooks.length
          ? <div className="book-grid">{visibleBooks.map((book) => <BookCard key={book.id} book={book} language={language} t={t} />)}</div>
          : <div className="empty-state">{t.noResults}</div>}
      </section>
    ),
    languages: (
      <section className="language-section">
        <div><div className="eyebrow"><i />{t.languages}</div><h2>{t.independent}</h2><p>{t.languageIntro}</p></div>
        <div className="language-cards">
          <button onClick={() => setLanguage("gu")} className="language-card gu"><span>ગુજરાતી</span><small>GUJARATI</small></button>
          <button onClick={() => setLanguage("hi")} className="language-card hi"><span>हिन्दी</span><small>HINDI</small></button>
          <button onClick={() => setLanguage("en")} className="language-card en"><span>English</span><small>ENGLISH</small></button>
        </div>
      </section>
    ),
    authors: (
      <section className="author-section" id="authors">
        <div className="author-visual">
          <span className="author-orbit" />
          <div className="author-quote">“<br /><span>Words find<br />their people.</span></div>
          <div className="author-seal">✦<small>AUTHOR<br />STUDIO</small></div>
        </div>
        <div className="author-copy">
          <div className="eyebrow"><i />{t.forAuthors}</div><h2>{t.meet}</h2><p>{t.meetIntro}</p>
          <div className="author-point"><Check size={17} /><div><strong>{t.forReaders}</strong><p>{t.readerText}</p></div></div>
          <div className="author-point"><Check size={17} /><div><strong>{t.forAuthors}</strong><p>{t.authorText}</p></div></div>
          <Link className="button button-dark" to="/author/apply">{t.learnMore}<ArrowRight size={16} /></Link>
        </div>
      </section>
    ),
    community: (
      <section className="newsletter" id="about">
        <div><div className="eyebrow"><i />{t.community}</div><h2>{subscribed ? t.subscribed : t.newsletter}</h2><p>{t.newsletterText}</p></div>
        <form onSubmit={(event) => { event.preventDefault(); setSubscribed(true); }}>
          <label className="sr-only" htmlFor="email">{t.email}</label><input id="email" type="email" required placeholder={t.email} />
          <button aria-label={t.subscribe} type="submit">{subscribed ? <Check size={18} /> : <ArrowRight size={18} />}</button>
        </form>
      </section>
    ),
  };

  return (
    <main>
      {sections.filter((section) => section.enabled).map((section) => (
        <Fragment key={section.id}>{section.id.startsWith("custom-") ? (
          <section className="section custom-home-section" id={section.id}>
            <div className="section-head"><div className="eyebrow"><i />{t.curated}</div><h2>{section.title?.[language] || section.title?.en}</h2></div>
            {section.imageUrl && <img loading="lazy" src={section.imageUrl} alt={section.title?.[language] || section.title?.en || ""} style={{ display: "block", maxWidth: "100%", maxHeight: 400, objectFit: "cover", margin: "18px 0" }} />}
            {section.description?.[language] && <p>{section.description[language]}</p>}
            {section.linkLabel?.[language] && section.href && <a className="text-link" href={section.href}>{section.linkLabel[language]}<ArrowUpRight size={16} /></a>}
          </section>
        ) : sectionContent[section.id] || null}</Fragment>
      ))}
    </main>
  );
}
