import { useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Check, Feather, Search, Sparkles, Users } from "lucide-react";
import BookCard from "../../components/books/BookCard.jsx";
import SectionHeading from "../../components/common/SectionHeading.jsx";
import { useBookCatalogue } from "../../hooks/useBookCatalogue.js";
import { useLanguage } from "../../hooks/useLanguage.js";
import { categories } from "../../data/sampleBooks.js";

export default function HomePage() {
  const { language, setLanguage, t } = useLanguage();
  const [activeCategory, setActiveCategory] = useState("All books");
  const [query, setQuery] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const filteredBooks = useBookCatalogue({ category: activeCategory, query });

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" />{t.eyebrow}</div>
          <h1>{t.headline.split(" ").slice(0, -1).join(" ")} <em>{t.headline.split(" ").slice(-1)}</em></h1>
          <p className="hero-intro">{t.intro}</p>
          <div className="hero-actions"><a href="#discover" className="button button-dark">{t.explore}<ArrowRight size={17} /></a><a href="#authors" className="button button-outline">{t.authorCta}<ArrowUpRight size={16} /></a></div>
          <div className="hero-note"><span className="note-star">✳</span>{t.note}</div>
        </div>
        <div className="hero-art" aria-label="A collection of books from Rasbhav Books">
          <div className="art-sun" /><div className="art-caption">A shelf of<br />possibilities <ArrowDown size={15} /></div>
          <div className="floating-leaf leaf-one">✳</div><div className="floating-leaf leaf-two">✺</div>
          <div className="hero-book book-back"><div className="hero-book-spine" /></div>
          <div className="hero-book book-middle"><div className="hero-book-spine" /></div>
          <div className="hero-book book-front"><span className="mini-seal">R<br />B</span><span className="book-front-title">stories<br />to keep</span><span className="book-front-author">RASBHAV BOOKS</span></div>
          <div className="hero-ground" />
        </div>
        <span className="hero-index">01 / 03 &nbsp; • &nbsp; THE READING ROOM</span>
      </section>

      <section className="trust-strip"><span><Sparkles size={16} /> Independent authors</span><i /><span><BookOpen size={16} /> Stories in 3 languages</span><i /><span><Users size={16} /> Made for readers</span></section>

      <section className="section discover-section" id="discover">
        <SectionHeading eyebrow={t.curated} title={t.picks} action={<a href="#discover" className="text-link">{t.viewAll}<ArrowUpRight size={16} /></a>} />
        <div className="catalog-controls">
          <div className="category-tabs" role="group" aria-label={t.filterCategories}>
            {categories.map((category) => <button key={category} className={activeCategory === category ? "category-tab active" : "category-tab"} onClick={() => setActiveCategory(category)}>{category === "All books" ? t.all : t.categories[category]}</button>)}
          </div>
          <label className="search-box"><Search size={17} /><span className="sr-only">{t.search}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} />{query && <button type="button" onClick={() => setQuery("")} aria-label={t.clearSearch}>×</button>}</label>
        </div>
        {filteredBooks.length ? <div className="book-grid">{filteredBooks.map((book) => <BookCard key={book.id} book={book} language={language} t={t} />)}</div> : <div className="empty-state"><BookOpen size={25} /><p>{t.noResults}</p></div>}
      </section>

      <section className="language-band" id="languages">
        <div className="language-copy"><div className="eyebrow"><span className="eyebrow-line" />{t.languages}</div><h2>{t.independent}</h2><p>{t.languageIntro}</p></div>
        <div className="language-cards">
          <button className="language-card lang-gu" onClick={() => setLanguage("gu")}><span>ગુજરાતી</span><small>Gujarati</small><ArrowUpRight size={18} /></button>
          <button className="language-card lang-hi" onClick={() => setLanguage("hi")}><span>हिन्दी</span><small>Hindi</small><ArrowUpRight size={18} /></button>
          <button className="language-card lang-en" onClick={() => setLanguage("en")}><span>English</span><small>English</small><ArrowUpRight size={18} /></button>
        </div>
      </section>

      <section className="author-section" id="authors">
        <div className="author-art"><div className="author-circle circle-a" /><div className="author-circle circle-b" /><div className="author-quote">“<br /><span>Words find<br />their people.</span></div><div className="author-stamp"><Feather size={18} /><span>THE AUTHOR<br />STUDIO</span></div></div>
        <div className="author-copy"><div className="eyebrow"><span className="eyebrow-line" />{t.forAuthors}</div><h2>{t.meet}</h2><p>{t.meetIntro}</p>
          <div className="author-feature"><span><Check size={15} /></span><div><strong>{t.forReaders}</strong><p>{t.readerText}</p></div></div>
          <div className="author-feature"><span><Check size={15} /></span><div><strong>{t.forAuthors}</strong><p>{t.authorText}</p></div></div>
          <a href="#about" className="button button-dark">{t.learnMore}<ArrowRight size={16} /></a>
        </div>
      </section>

      <section className="newsletter" id="about">
        <div><div className="eyebrow"><span className="eyebrow-line" />{t.community}</div><h2>{subscribed ? t.subscribed : t.newsletter}</h2><p>{t.newsletterText}</p></div>
        <form className="newsletter-form" onSubmit={(event) => { event.preventDefault(); setSubscribed(true); }}>
          <label className="sr-only" htmlFor="newsletter-email">{t.email}</label><input id="newsletter-email" type="email" required placeholder={t.email} /><button type="submit">{subscribed ? <Check size={19} /> : <ArrowRight size={19} />}<span className="sr-only">{t.subscribe}</span></button>
          <small>{t.consent}</small>
        </form>
      </section>
    </main>
  );
}
