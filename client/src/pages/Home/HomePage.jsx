import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, ArrowUpRight, BookOpen, Check, Search, Sparkles, Users } from "lucide-react";
import BookCard from "../../components/books/BookCard.jsx";
import { useCategories } from "../../hooks/useCategories.js";
import { usePaginatedBooks } from "../../hooks/useBooks.js";
import { getBookById } from "../../services/bookService.js";
import { getBookTitle } from "../../data/books.js";
import { getPopularSearchTrends, recordSearchTrend } from "../../services/searchTrendService.js";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useSiteContent } from "../../hooks/useSiteContent.js";
import { usePageMetadata } from "../../hooks/usePageMetadata.js";
import { defaultSiteContent } from "../../../../shared/site-content.js";

export default function HomePage() {
  const { language, setLanguage, t } = useLanguage();
  const { settings } = useSiteContent();
  const { categories, getCategoryLabel } = useCategories();
  const featuredBookIds = settings.homepage?.featuredBookIds || [];
  const featuredBookIdsKey = featuredBookIds.join("|");
  const [featuredBooks, setFeaturedBooks] = useState([]);
  useEffect(() => {
    let active = true;
    Promise.all(featuredBookIds.map((id) => getBookById(id))).then((results) => {
      if (active) setFeaturedBooks(results.filter(Boolean));
    });
    return () => { active = false; };
  }, [featuredBookIdsKey]);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [bookLanguage, setBookLanguage] = useState("");
  const [priceType, setPriceType] = useState("all");
  const [sort, setSort] = useState("featured");
  const [page, setPage] = useState(1);
  const [searchHistory, setSearchHistory] = useState([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [popularSearchTrends, setPopularSearchTrends] = useState([]);
  const [searchAnalyticsConsent, setSearchAnalyticsConsent] = useState(() => {
    try {
      const saved = window.localStorage.getItem("rasbhav.books.searchAnalyticsConsent.v1");
      return saved === "allow" ? true : saved === "decline" ? false : null;
    } catch {
      return null;
    }
  });
  const [subscribed, setSubscribed] = useState(false);
  const { items: visibleBooks, total: totalBooks, loading: catalogueLoading, hasMore } = usePaginatedBooks({ category, query, language, bookLanguage, priceType, sort, page });

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("rasbhav.books.searchHistory.v1") || "[]");
      if (Array.isArray(saved)) {
        setSearchHistory(saved.filter((item) => typeof item === "string" && item.trim() && item.trim().length <= 100).map((item) => item.trim()).slice(0, 8));
      }
    } catch {
      setSearchHistory([]);
    }
  }, []);

  function rememberSearch(value) {
    const term = value.trim();
    if (!term) return;
    const locale = { en: "en-IN", gu: "gu-IN", hi: "hi-IN" }[language] || "en-IN";
    const next = [term, ...searchHistory.filter((item) => item.toLocaleLowerCase(locale) !== term.toLocaleLowerCase(locale))].slice(0, 8);
    setSearchHistory(next);
    try {
      window.localStorage.setItem("rasbhav.books.searchHistory.v1", JSON.stringify(next));
    } catch {
      // Search remains usable if browser storage is unavailable.
    }
  }

  function chooseSearchAnalyticsConsent(allowed) {
    setSearchAnalyticsConsent(allowed);
    try {
      window.localStorage.setItem("rasbhav.books.searchAnalyticsConsent.v1", allowed ? "allow" : "decline");
    } catch {
      // The current choice still applies for this visit if browser storage is unavailable.
    }
  }

  function manageSearchAnalyticsConsent() {
    setSearchAnalyticsConsent(null);
    try {
      window.localStorage.removeItem("rasbhav.books.searchAnalyticsConsent.v1");
    } catch {
      // The prompt remains available in memory.
    }
  }

  async function loadPopularSearchTrends() {
    setPopularSearchTrends(await getPopularSearchTrends());
  }

  function clearSearchHistory() {
    setSearchHistory([]);
    try {
      window.localStorage.removeItem("rasbhav.books.searchHistory.v1");
    } catch {
      // Clearing the visible in-memory history still works.
    }
  }

  const searchSuggestions = searchHistory.filter((item) => !query.trim()
    || item.toLocaleLowerCase(language).includes(query.trim().toLocaleLowerCase(language)));
  const searchTerm = query.trim().toLocaleLowerCase({ en: "en-IN", gu: "gu-IN", hi: "hi-IN" }[language] || "en-IN");
  const bookSuggestions = searchTerm
    ? visibleBooks.filter((book) => [getBookTitle(book, language), book.author]
      .filter((value) => typeof value === "string")
      .some((value) => value.toLocaleLowerCase({ en: "en-IN", gu: "gu-IN", hi: "hi-IN" }[language] || "en-IN").includes(searchTerm)))
      .slice(0, 5)
    : [];
  const hero = settings.homepage?.hero || {};
  usePageMetadata({
    title: settings.homepage?.seo?.title?.[language] || "",
    description: settings.homepage?.seo?.description?.[language] || "",
    type: "website",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: settings.platform?.siteName || "Rasbhav Books",
      description: settings.homepage?.seo?.description?.[language] || "",
      url: typeof window === "undefined" ? "" : window.location.origin,
      inLanguage: { en: "en", gu: "gu-IN", hi: "hi-IN" }[language],
    },
  });
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
    featured: (
      featuredBooks.length ? (
        <section className="section" id="featured-books">
          <div className="section-head"><div className="eyebrow"><i />{t.curated}</div><h2>{t.featuredBooksWidgetHeading}</h2></div>
          <div className="book-grid">{featuredBooks.map((book) => <BookCard key={book.id} book={book} language={language} t={t} />)}</div>
        </section>
      ) : null
    ),
    discovery: (
      <section className="section" id="discover">
        <div className="section-head">
          <div className="eyebrow"><i />{t.curated}</div><h2>{t.picks}</h2>
          <a href="#discover" className="text-link">{t.viewAll}<ArrowUpRight size={16} /></a>
        </div>
        <div className="catalog-tools">
          <div className="search-box">
            <label className="search"><Search size={17} /><span className="sr-only">{t.search}</span><input maxLength={100} value={query}
              onFocus={() => { setShowSearchSuggestions(true); if (!query.trim()) void loadPopularSearchTrends(); }}
              onBlur={() => window.setTimeout(() => setShowSearchSuggestions(false), 120)}
              onKeyDown={(event) => {
                if (event.key === "Enter") { event.preventDefault(); const term = event.currentTarget.value; rememberSearch(term); if (term.trim() && searchAnalyticsConsent === true) void recordSearchTrend(term); setShowSearchSuggestions(false); }
                if (event.key === "Escape") setShowSearchSuggestions(false);
              }}
              onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={t.search} /></label>
            {showSearchSuggestions && <div className="search-suggestions" role="region" aria-label={t.searchBookSuggestions}>
              {bookSuggestions.length > 0 && <>
                <div className="search-suggestions-head"><strong>{t.searchBookSuggestions}</strong></div>
                {bookSuggestions.map((book) => <Link className="search-suggestion" key={book.id} to={`/books/${encodeURIComponent(book.id)}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setShowSearchSuggestions(false)}>
                  {getBookTitle(book, language)} <span>— {t.by} {book.author}</span>
                </Link>)}
              </>}
              {!query.trim() && popularSearchTrends.length > 0 && <>
                <div className="search-suggestions-head"><strong>{t.searchTrendsTitle}</strong></div>
                {popularSearchTrends.map((term, index) => <button className="search-suggestion" type="button" key={`trend-${term}-${index}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => { setQuery(term); setPage(1); setShowSearchSuggestions(false); }}>{term}</button>)}
              </>}
              {searchSuggestions.length > 0 && <>
                <div className="search-suggestions-head"><strong>{t.searchHistoryTitle}</strong><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={clearSearchHistory}>{t.clearSearchHistory}</button></div>
                <p className="search-suggestions-hint">{t.searchHistoryHint}</p>
                {searchSuggestions.map((term, index) => <button className="search-suggestion" type="button" key={`${term}-${index}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => { setQuery(term); setPage(1); setShowSearchSuggestions(false); }}>{term}</button>)}
              </>}
              {searchAnalyticsConsent === null
                ? <div className="search-analytics-consent">
                    <p>{t.searchAnalyticsConsentText}</p>
                    <div><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => chooseSearchAnalyticsConsent(true)}>{t.enableSearchAnalytics}</button>
                    <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => chooseSearchAnalyticsConsent(false)}>{t.declineSearchAnalytics}</button></div>
                  </div>
                : <div className="search-analytics-consent">
                    <span>{searchAnalyticsConsent ? t.searchAnalyticsEnabled : t.searchAnalyticsDisabled}</span>
                    <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={manageSearchAnalyticsConsent}>{t.manageSearchAnalytics}</button>
                  </div>}
            </div>}
          </div>
          <div className="catalog-refinements">
            <label className="catalog-refinement"><span>{t.priceFilter}</span><select value={priceType} onChange={(event) => { setPriceType(event.target.value); setPage(1); }}>
              <option value="all">{t.allPrices}</option>
              <option value="free">{t.freeBooksFilter}</option>
              <option value="paid">{t.paidBooksFilter}</option>
            </select></label>
            <label className="catalog-refinement"><span>{t.bookLanguageFilter}</span><select value={bookLanguage} onChange={(event) => { setBookLanguage(event.target.value); setPage(1); }}>
              <option value="">{t.allLanguages}</option>
              <option value="Gujarati">{t.gujarati}</option>
              <option value="Hindi">{t.hindi}</option>
              <option value="English">{t.english}</option>
            </select></label>
            <label className="catalog-refinement"><span>{t.sortBooks}</span><select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}>
              <option value="featured">{t.sortFeatured}</option>
              <option value="title">{t.sortTitle}</option>
              <option value="author">{t.sortAuthor}</option>
            </select></label>
          </div>
          <div className="category-list" id="categories" aria-label={t.filter}>
            {categories.map(({ key }) => <button key={key} className={category === key ? "category active" : "category"} onClick={() => { setCategory(key); setPage(1); }}>{getCategoryLabel(key)}</button>)}
          </div>
          {category !== "All" && <Link className="text-link" to={`/categories/${encodeURIComponent(category)}`}>{t.categoryPageView}<ArrowUpRight size={16} /></Link>}
        </div>
        {visibleBooks.length > 0 && <div className="book-grid">{visibleBooks.map((book) => <BookCard key={book.id} book={book} language={language} t={t} />)}</div>}
        {catalogueLoading && <p role="status" aria-live="polite">{t.loading}</p>}
        {!catalogueLoading && !visibleBooks.length && <div className="empty-state">{t.noResults}</div>}
        {hasMore && <button className="button button-light" type="button" disabled={catalogueLoading} onClick={() => setPage((current) => current + 1)}>{t.catalogueShowMore} · {visibleBooks.length}/{totalBooks}</button>}
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
            {section.imageUrl && <img loading="lazy" src={section.imageUrl} alt={section.imageAlt?.[language] || section.imageAlt?.en || section.title?.[language] || section.title?.en || ""} style={{ display: "block", maxWidth: "100%", maxHeight: 400, objectFit: "cover", margin: "18px 0" }} />}
            {section.description?.[language] && <p>{section.description[language]}</p>}
            {section.linkLabel?.[language] && section.href && <a className="text-link" href={section.href}>{section.linkLabel[language]}<ArrowUpRight size={16} /></a>}
          </section>
        ) : sectionContent[section.id] || null}</Fragment>
      ))}
    </main>
  );
}
