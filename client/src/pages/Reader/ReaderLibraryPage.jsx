import BookCard from "../../components/books/BookCard.jsx";
import { ReadingChallengeSummary } from "../../components/reader/ReadingChallenge.jsx";
import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { Link, Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { getReaderRecommendations, getReaderLibrary, getRecentlyOpenedBooks, clearReaderReadingHistory } from "../../services/readerLibraryService.js";

const styles = `
.reader-library{max-width:1120px;min-height:70vh;margin:auto;padding:64px 24px 90px}
.reader-library h1{margin:13px 0 8px;font:500 clamp(36px,5vw,54px)/1.08 var(--serif);color:#30252c}
.reader-library-intro{max-width:620px;margin:0 0 38px;color:#77716a;font-size:13px;line-height:1.8}
.library-section{margin:38px 0}
.library-section-heading{display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:16px}
.library-section-heading h2{margin:0;font:500 28px/1.15 var(--serif);color:#30252c}.library-clear-history{border:1px solid #b8aa97;background:transparent;color:#635951;padding:8px 10px;font:inherit;font-size:10px;cursor:pointer}.library-clear-history:disabled{opacity:.55;cursor:wait}
.library-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.library-card{display:grid;grid-template-columns:88px minmax(0,1fr);gap:15px;min-height:150px;padding:14px;border:1px solid var(--line);background:#fffdfa}
.library-card-cover{display:flex;flex-direction:column;justify-content:space-between;min-height:120px;padding:11px 9px;background:linear-gradient(145deg,#493944,#30252c);color:#fff}
.library-card-cover span{font-size:9px;letter-spacing:.12em;text-transform:uppercase}
.library-card-cover strong{font:500 16px/1.12 var(--serif);overflow-wrap:anywhere}
.library-card-copy{display:flex;flex-direction:column;align-items:flex-start;gap:7px;min-width:0}
.library-card-copy h3{margin:0;font:500 19px/1.2 var(--serif);overflow-wrap:anywhere;color:#30252c}
.library-card-author{margin:0;color:#77716a;font-size:11px}.library-card-last-opened{margin:0;color:#77716a;font-size:10px}.library-card-bookmark{margin:0;color:#635951;font-size:10px;line-height:1.5;overflow-wrap:anywhere}
.library-card-tag{color:#316342;font-size:10px;letter-spacing:.06em;text-transform:uppercase}
.library-read-link{display:inline-flex;align-items:center;gap:6px;margin-top:auto;padding:8px 10px;background:#30252c;color:#fff;text-decoration:none;font-size:10px}
.library-more{display:block;margin:17px auto 0;min-height:40px;padding:0 18px;border:1px solid #b8aa97;background:#fffdfa;color:#30252c;font:inherit;font-size:11px;cursor:pointer}
.library-more:disabled{opacity:.55;cursor:wait}
.library-empty,.library-error{padding:22px;border:1px solid var(--line);background:#fffdfa;color:#77716a;font-size:12px;line-height:1.7}
.library-error{color:#863d32;background:#f8ece8}
@media(max-width:760px){.library-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.reader-library{padding:45px 19px 70px}.library-grid{grid-template-columns:1fr}.library-card{grid-template-columns:76px minmax(0,1fr)}.library-card-cover{min-height:112px}.library-section-heading h2{font-size:24px}}
`;

function RecommendedBooks({ language, t }) {
  const [books, setBooks] = useState([]);
  useEffect(() => {
    let active = true;
    getReaderRecommendations().then(result => { if (active) setBooks(result.books); })
      .catch(() => { if (active) setBooks([]); });
    return () => { active = false; };
  }, []);
  if (!books.length) return null;
  const labels = {
    gu: ["તમારા માટે પુસ્તકો", "તમે વાંચી લીધેલાં પુસ્તકોની શ્રેણી પરથી."],
    hi: ["आपके लिए किताबें", "आपकी पढ़ी हुई किताबों की श्रेणियों के आधार पर।"],
    en: ["Books for you", "Based on the categories of books you've marked as read."],
  }[language];
  return <section className="library-section" aria-labelledby="library-recommendations">
    <div className="library-section-heading"><h2 id="library-recommendations">{labels[0]}</h2></div>
    <p>{labels[1]}</p>
    <div className="library-grid">{books.map(book => <BookCard key={book.id} book={book} language={language} t={t} />)}</div>
  </section>;
}

function BookSection({ title, books, cursor, onMore, loadingMore, onClear, clearing, t, language }) {
  if (!books.length && !cursor) return null;
  return (
    <section className="library-section" aria-labelledby={`library-${title}`}>
      <div className="library-section-heading"><h2 id={`library-${title}`}>{title}</h2>{onClear && books.length > 0 && <button className="library-clear-history" type="button" onClick={onClear} disabled={clearing}>{clearing ? t.libraryClearingHistory : t.libraryClearHistory}</button>}</div>
      {books.length ? (
        <div className="library-grid">
          {books.map((book) => (
            <article className="library-card" key={book.id}>
              <div className="library-card-cover" aria-hidden="true"><span>{book.language}</span><strong>{book.title?.[language] || book.title?.en}</strong></div>
              <div className="library-card-copy">
                <h3>{book.title?.[language] || book.title?.en}</h3>
                <p className="library-card-author">{t.by} {book.author}</p>
                <span className="library-card-tag">{book.accessKind === "free" ? t.libraryFreeLabel : t.libraryPurchasedLabel}</span>
                {book.lastOpenedAt && <p className="library-card-last-opened">{t.libraryLastOpened}: {new Intl.DateTimeFormat(language === "gu" ? "gu-IN" : language === "hi" ? "hi-IN" : "en-IN", { dateStyle: "medium" }).format(new Date(book.lastOpenedAt))}</p>}
                {book.bookmark && <p className="library-card-bookmark">{t.libraryBookmarkPage}: {book.bookmark.pageNumber}{book.bookmark.note ? ` · ${t.libraryBookmarkNote}: ${book.bookmark.note}` : ""}</p>}
                <Link className="library-read-link" to={`/read/${encodeURIComponent(book.id)}`}>{t.libraryReadBook}<ArrowUpRight size={14} /></Link>
              </div>
            </article>
          ))}
        </div>
      ) : <p className="library-empty">{t.libraryEmptySection}</p>}
      {cursor && <button className="library-more" type="button" onClick={onMore} disabled={loadingMore}>{loadingMore ? t.libraryLoadingMore : t.libraryLoadMore}</button>}
    </section>
  );
}

export default function ReaderLibraryPage() {
  const { user, loading } = useAuth();
  const { language, t } = useLanguage();
  const [recentBooks, setRecentBooks] = useState([]);
  const [recommendationsRevision, setRecommendationsRevision] = useState(0);
  const [freeBooks, setFreeBooks] = useState([]);
  const [purchasedBooks, setPurchasedBooks] = useState([]);
  const [freeCursor, setFreeCursor] = useState(null);
  const [purchasedCursor, setPurchasedCursor] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadingSection, setLoadingSection] = useState("");
  const [clearingHistory, setClearingHistory] = useState(false);
  const [error, setError] = useState("");

  const loadFirstPage = useCallback(async () => {
    if (!user?.id) return;
    setPageLoading(true);
    setError("");
    try {
      const [libraryResult, recentResult] = await Promise.allSettled([getReaderLibrary(), getRecentlyOpenedBooks()]);
      if (libraryResult.status === "rejected") throw libraryResult.reason;
      const result = libraryResult.value;
      setRecentBooks(recentResult.status === "fulfilled" ? recentResult.value : []);
      setFreeBooks(result.freeBooks || []);
      setPurchasedBooks(result.purchasedBooks || []);
      setFreeCursor(result.freeNextCursor || null);
      setPurchasedCursor(result.purchasedNextCursor || null);
    } catch {
      setError(t.libraryError);
    } finally {
      setPageLoading(false);
    }
  }, [user?.id, t.libraryError]);

  useEffect(() => { loadFirstPage(); }, [loadFirstPage]);

  async function clearHistory() {
    if (clearingHistory || !window.confirm(t.libraryConfirmClearHistory)) return;
    setClearingHistory(true);
    setError("");
    try {
      await clearReaderReadingHistory();
      setRecentBooks([]);
    } catch {
      setError(t.libraryError);
    } finally {
      setClearingHistory(false);
    }
  }

  async function loadMore(section) {
    const cursor = section === "free" ? freeCursor : purchasedCursor;
    if (!cursor || loadingSection) return;
    setLoadingSection(section);
    setError("");
    try {
      const result = await getReaderLibrary(section === "free" ? { freeCursor: cursor } : { purchasedCursor: cursor });
      if (section === "free") {
        setFreeBooks((current) => [...current, ...(result.freeBooks || [])]);
        setFreeCursor(result.freeNextCursor || null);
      } else {
        setPurchasedBooks((current) => [...current, ...(result.purchasedBooks || [])]);
        setPurchasedCursor(result.purchasedNextCursor || null);
      }
    } catch {
      setError(t.libraryError);
    } finally {
      setLoadingSection("");
    }
  }

  if (loading) return <main className="reader-library"><p>{t.loadingAccount}</p></main>;
  if (!user) return <Navigate to="/reader/login" replace />;

  return (
    <main className="reader-library">
      <style>{styles}</style>
      <div className="eyebrow"><i /><BookOpen size={15} />{t.readerSpace}</div>
      <h1>{t.libraryTitle}</h1>
      <p className="reader-library-intro">{t.libraryIntro}</p>
      <ReadingChallengeSummary key={user.id} language={language} onCompletionRemoved={() => setRecommendationsRevision(value => value + 1)} />
      <RecommendedBooks key={user.id + ":" + recommendationsRevision} language={language} t={t} />
      {error && <p className="library-error" role="alert">{error}</p>}
      {pageLoading ? <p aria-live="polite">{t.libraryLoading}</p> : (
        <>
          {!recentBooks.length && !freeBooks.length && !purchasedBooks.length && <p className="library-empty">{t.libraryEmpty}</p>}
          <BookSection title={t.libraryRecentTitle} books={recentBooks} cursor={null} onMore={() => {}} loadingMore={false} onClear={clearHistory} clearing={clearingHistory} t={t} language={language} />
          <BookSection title={t.libraryFreeTitle} books={freeBooks} cursor={freeCursor} onMore={() => loadMore("free")} loadingMore={loadingSection === "free"} t={t} language={language} />
          <BookSection title={t.libraryPurchasedTitle} books={purchasedBooks} cursor={purchasedCursor} onMore={() => loadMore("purchased")} loadingMore={loadingSection === "purchased"} t={t} language={language} />
        </>
      )}
      <Link className="account-back" to="/account">{t.accountPage}</Link>
    </main>
  );
}
