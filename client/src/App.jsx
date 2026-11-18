import { useMemo, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Check, Feather, Search, Sparkles, Users } from "lucide-react";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import BookCard from "./components/BookCard.jsx";
import { books, copy } from "./data/books.js";

const categories = ["All books", "Fiction", "Poetry", "Wisdom", "Culture"];

function App() {
  const [language, setLanguage] = useState("en");
  const [activeCategory, setActiveCategory] = useState("All books");
  const [query, setQuery] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const t = copy[language];
  const filteredBooks = useMemo(() => books.filter((book) => {
    const matchesCategory = activeCategory === "All books" || book.category === activeCategory;
    const text = [book.title, book.gu, book.hi, book.author, book.category, book.language].join(" ").toLowerCase();
    return matchesCategory && text.includes(query.trim().toLowerCase());
  }), [activeCategory, query]);

  return (
    <div id="home" className={`app locale-${language}`}>
      <Header language={language} setLanguage={setLanguage} t={t}/>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line"/> {t.eyebrow}</div>
            <h1>{t.headline.split(" ").slice(0, -1).join(" ")} <em>{t.headline.split(" ").slice(-1)}</em></h1>
            <p className="hero-intro">{t.intro}</p>
            <div className="hero-actions"><a href="#discover" className="button button-dark">{t.explore}<ArrowRight size={17}/></a><a href="#authors" className="button button-outline">{t.authorCta}<ArrowUpRight size={16}/></a></div>
            <div className="hero-note"><span className="note-star">✳</span>{t.note}</div>
          </div>
          <div className="hero-art" aria-label="A collection of books from Rasbhav Books">
            <div className="art-sun"/><div className="art-caption">A shelf of<br/>possibilities <ArrowDown size={15}/></div>
            <div className="floating-leaf leaf-one">✳</div><div className="floating-leaf leaf-two">✺</div>
            <div className="hero-book book-back"><div className="hero-book-spine"/></div>
            <div className="hero-book book-middle"><div className="hero-book-spine"/></div>
            <div className="hero-book book-front"><span className="mini-seal">R<br/>B</span><span className="book-front-title">stories<br/>to keep</span><span className="book-front-author">RASBHAV BOOKS</span></div>
            <div className="hero-ground"/>
          </div>
          <span className="hero-index">01 / 03 &nbsp; • &nbsp; THE READING ROOM</span>
        </section>

        <section className="trust-strip"><span><Sparkles size={16}/> Independent authors</span><i/><span><BookOpen size={16}/> Stories in 3 languages</span><i/><span><Users size={16}/> Made for readers</span></section>

        <section className="section discover-section" id="discover">
          <div className="section-heading">
            <div><div className="eyebrow"><span className="eyebrow-line"/> {t.curated}</div><h2>{t.picks}</h2></div>
            <a href="#discover" className="text-link">{t.viewAll}<ArrowUpRight size={16}/></a>
          </div>
          <div className="catalog-controls">
            <div className="category-tabs" role="group" aria-label="Filter books by category">{categories.map((category) => <button key={category} className={activeCategory === category ? "category-tab active" : "category-tab"} onClick={() => setActiveCategory(category)}>{category === "All books" ? t.all : t.categories[category]}</button>)}</div>
            <label className="search-box"><Search size={17}/><span className="sr-only">{t.search}</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search}/>{query && <button onClick={() => setQuery("")} aria-label="Clear search">×</button>}</label>
          </div>
          {filteredBooks.length ? <div className="book-grid">{filteredBooks.map((book) => <BookCard key={book.id} book={book} language={language} t={t}/>)}</div> : <div className="empty-state"><BookOpen size={25}/><p>{t.noResults}</p></div>}
        </section>

        <section className="language-band" id="languages">
          <div className="language-copy"><div className="eyebrow"><span className="eyebrow-line"/> {t.languages}</div><h2>{t.independent}</h2><p>{t.languageIntro}</p></div>
          <div className="language-cards">
            <button className="language-card lang-gu" onClick={() => setLanguage("gu")}><span>ગુજરાતી</span><small>Gujarati</small><ArrowUpRight size={18}/></button>
            <button className="language-card lang-hi" onClick={() => setLanguage("hi")}><span>हिन्दी</span><small>Hindi</small><ArrowUpRight size={18}/></button>
            <button className="language-card lang-en" onClick={() => setLanguage("en")}><span>English</span><small>English</small><ArrowUpRight size={18}/></button>
          </div>
        </section>

        <section className="author-section" id="authors">
          <div className="author-art"><div className="author-circle circle-a"/><div className="author-circle circle-b"/><div className="author-quote">“<br/><span>Words find<br/>their people.</span></div><div className="author-stamp"><Feather size={18}/><span>THE AUTHOR<br/>STUDIO</span></div></div>
          <div className="author-copy"><div className="eyebrow"><span className="eyebrow-line"/> {t.forAuthors}</div><h2>{t.meet}</h2><p>{t.meetIntro}</p><div className="author-feature"><span><Check size={15}/></span><div><strong>{t.forReaders}</strong><p>{t.readerText}</p></div></div><div className="author-feature"><span><Check size={15}/></span><div><strong>{t.forAuthors}</strong><p>{t.authorText}</p></div></div><a href="#about" className="button button-dark">{t.learnMore}<ArrowRight size={16}/></a></div>
        </section>

        <section className="newsletter" id="about">
          <div><div className="eyebrow"><span className="eyebrow-line"/> {t.community}</div><h2>{subscribed ? "You’re on the list. Thank you." : t.newsletter}</h2><p>{t.newsletterText}</p></div>
          <form className="newsletter-form" onSubmit={(e) => { e.preventDefault(); setSubscribed(true); }}>
            <label className="sr-only" htmlFor="newsletter-email">{t.email}</label><input id="newsletter-email" type="email" required placeholder={t.email}/><button type="submit">{subscribed ? <Check size={19}/> : <ArrowRight size={19}/>}<span className="sr-only">{t.subscribe}</span></button>
            <small>By subscribing, you agree to receive occasional updates from Rasbhav Books.</small>
          </form>
        </section>
      </main>
      <Footer t={t}/>
    </div>
  );
}

export default App;
