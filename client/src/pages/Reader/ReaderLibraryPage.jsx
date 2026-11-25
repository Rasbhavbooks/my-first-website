import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { Link, Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { getReaderLibrary } from "../../services/readerLibraryService.js";

const styles = `
.reader-library{max-width:1120px;min-height:70vh;margin:auto;padding:64px 24px 90px}
.reader-library h1{margin:13px 0 8px;font:500 clamp(36px,5vw,54px)/1.08 var(--serif);color:#30252c}
.reader-library-intro{max-width:620px;margin:0 0 38px;color:#77716a;font-size:13px;line-height:1.8}
.library-section{margin:38px 0}
.library-section-heading{display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:16px}
.library-section-heading h2{margin:0;font:500 28px/1.15 var(--serif);color:#30252c}
.library-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.library-card{display:grid;grid-template-columns:88px minmax(0,1fr);gap:15px;min-height:150px;padding:14px;border:1px solid var(--line);background:#fffdfa}
.library-card-cover{display:flex;flex-direction:column;justify-content:space-between;min-height:120px;padding:11px 9px;background:linear-gradient(145deg,#493944,#30252c);color:#fff}
.library-card-cover span{font-size:9px;letter-spacing:.12em;text-transform:uppercase}
.library-card-cover strong{font:500 16px/1.12 var(--serif);overflow-wrap:anywhere}
.library-card-copy{display:flex;flex-direction:column;align-items:flex-start;gap:7px;min-width:0}
.library-card-copy h3{margin:0;font:500 19px/1.2 var(--serif);overflow-wrap:anywhere;color:#30252c}
.library-card-author{margin:0;color:#77716a;font-size:11px}
.library-card-tag{color:#316342;font-size:10px;letter-spacing:.06em;text-transform:uppercase}
.library-read-link{display:inline-flex;align-items:center;gap:6px;margin-top:auto;padding:8px 10px;background:#30252c;color:#fff;text-decoration:none;font-size:10px}
.library-more{display:block;margin:17px auto 0;min-height:40px;padding:0 18px;border:1px solid #b8aa97;background:#fffdfa;color:#30252c;font:inherit;font-size:11px;cursor:pointer}
.library-more:disabled{opacity:.55;cursor:wait}
.library-empty,.library-error{padding:22px;border:1px solid var(--line);background:#fffdfa;color:#77716a;font-size:12px;line-height:1.7}
.library-error{color:#863d32;background:#f8ece8}
@media(max-width:760px){.library-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.reader-library{padding:45px 19px 70px}.library-grid{grid-template-columns:1fr}.library-card{grid-template-columns:76px minmax(0,1fr)}.library-card-cover{min-height:112px}.library-section-heading h2{font-size:24px}}
`;

function BookSection({ title, books, cursor, onMore, loadingMore, t, language }) {
  if (!books.length && !cursor) return null;
  return (
    <section className="library-section" aria-labelledby={`library-${title}`}>
      <div className="library-section-heading"><h2 id={`library-${title}`}>{title}</h2></div>
      {books.length ? (
        <div className="library-grid">
          {books.map((book) => (
            <article className="library-card" key={book.id}>
              <div className="library-card-cover" aria-hidden="true"><span>{book.language}</span><strong>{book.title?.[language] || book.title?.en}</strong></div>
              <div className="library-card-copy">
                <h3>{book.title?.[language] || book.title?.en}</h3>
                <p className="library-card-author">{t.by} {book.author}</p>
                <span className="library-card-tag">{book.accessKind === "free" ? t.libraryFreeLabel : t.libraryPurchasedLabel}</span>
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
  const [freeBooks, setFreeBooks] = useState([]);
  const [purchasedBooks, setPurchasedBooks] = useState([]);
  const [freeCursor, setFreeCursor] = useState(null);
  const [purchasedCursor, setPurchasedCursor] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadingSection, setLoadingSection] = useState("");
  const [error, setError] = useState("");

  const loadFirstPage = useCallback(async () => {
    if (!user?.id) return;
    setPageLoading(true);
    setError("");
    try {
      const result = await getReaderLibrary();
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
      {error && <p className="library-error" role="alert">{error}</p>}
      {pageLoading ? <p aria-live="polite">{t.libraryLoading}</p> : (
        <>
          {!freeBooks.length && !purchasedBooks.length && <p className="library-empty">{t.libraryEmpty}</p>}
          <BookSection title={t.libraryFreeTitle} books={freeBooks} cursor={freeCursor} onMore={() => loadMore("free")} loadingMore={loadingSection === "free"} t={t} language={language} />
          <BookSection title={t.libraryPurchasedTitle} books={purchasedBooks} cursor={purchasedCursor} onMore={() => loadMore("purchased")} loadingMore={loadingSection === "purchased"} t={t} language={language} />
        </>
      )}
      <Link className="account-back" to="/account">{t.accountPage}</Link>
    </main>
  );
}
