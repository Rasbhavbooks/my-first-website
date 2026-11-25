import { useEffect, useState } from "react";
import { ArrowLeft, Bookmark, ExternalLink, Trash2 } from "lucide-react";
import { Link, Navigate, useParams } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { deleteReaderBookBookmark, getReaderBookBookmark, getReaderLibraryBook, saveReaderBookBookmark } from "../../services/readerLibraryService.js";

const styles = [
.reader-page{max-width:1180px;min-height:78vh;margin:auto;padding:36px 24px 64px}
.reader-toolbar{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:20px}
.reader-toolbar a{display:inline-flex;align-items:center;gap:7px;color:#635951;font-size:11px}
.reader-book-heading{margin:0 0 14px;color:#30252c;font:500 clamp(28px,4vw,42px)/1.12 var(--serif)}
.reader-book-meta{margin:0 0 18px;color:#77716a;font-size:12px}
.reader-frame{display:block;width:100%;height:min(78vh,1000px);min-height:520px;border:1px solid #d8cec1;background:#eee9e0}
.reader-error{max-width:700px;margin:25px auto;padding:24px;border:1px solid #ead2c9;background:#fff9f6;color:#863d32;font-size:13px;line-height:1.8}
.reader-open-link{display:inline-flex;align-items:center;gap:7px;padding:10px 13px;background:#30252c;color:#fff;text-decoration:none;font-size:11px}
.reader-loading{padding:24px;color:#77716a;font-size:12px}
.reader-bookmark{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr) auto;gap:10px;align-items:end;margin:20px 0;padding:16px;border:1px solid #d8cec1;background:#fffdfa}
.reader-bookmark-field{display:grid;gap:6px;color:#635951;font-size:11px}
.reader-bookmark-field input{width:100%;min-height:40px;padding:8px 10px;border:1px solid #b8aa97;background:#fff;color:#30252c;font:inherit}
.reader-bookmark-actions{display:flex;gap:8px;align-items:center}
.reader-bookmark-actions button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:8px 12px;border:0;background:#30252c;color:white;font:inherit;font-size:11px;cursor:pointer}
.reader-bookmark-actions button:disabled{opacity:.55;cursor:wait}
.reader-bookmark-status{grid-column:1/-1;margin:0;color:#316342;font-size:11px}
.reader-bookmark-error{grid-column:1/-1;margin:0;color:#863d32;font-size:11px}
.reader-bookmark-hint{grid-column:1/-1;margin:0;color:#77716a;font-size:10px;line-height:1.6}
@media(max-width:600px){.reader-page{padding:26px 14px 44px}.reader-frame{height:72vh;min-height:420px}.reader-bookmark{grid-template-columns:1fr}.reader-bookmark-actions{flex-wrap:wrap}.reader-bookmark-status,.reader-bookmark-error,.reader-bookmark-hint{grid-column:auto}}
].join("");

export default function ReaderBookPage() {
  const { bookId } = useParams();
  const { user, loading } = useAuth();
  const { language, t } = useLanguage();
  const [book, setBook] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [bookmark, setBookmark] = useState(null);
  const [bookmarkPage, setBookmarkPage] = useState("");
  const [bookmarkNote, setBookmarkNote] = useState("");
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [bookmarkError, setBookmarkError] = useState("");
  const [bookmarkSaved, setBookmarkSaved] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user?.id || !bookId) return () => { active = false; };
    setPageLoading(true);
    setError("");
    setBookmarkError("");
    setBook(null);
    setBookmark(null);
    setBookmarkPage("");
    setBookmarkNote("");
    Promise.all([getReaderLibraryBook(bookId), getReaderBookBookmark(bookId)])
      .then(([result, savedBookmark]) => {
        if (!active) return;
        setBook(result);
        setBookmark(savedBookmark);
        if (savedBookmark) {
          setBookmarkPage(String(savedBookmark.pageNumber));
          setBookmarkNote(savedBookmark.note || "");
        }
      })
      .catch(async (loadError) => {
        if (!active) return;
        if (loadError.status === 404) {
          setError(t.readerAccessError);
          return;
        }
        try {
          const result = await getReaderLibraryBook(bookId);
          if (active) { setBook(result); setBookmarkError(t.readerBookmarkError); }
        } catch {
          if (active) setError(t.readerAccessError);
        }
      })
      .finally(() => { if (active) setPageLoading(false); });
    return () => { active = false; };
  }, [bookId, user?.id, t.readerAccessError, t.readerBookmarkError]);

  async function saveBookmark(event) {
    event.preventDefault();
    if (bookmarkLoading) return;
    setBookmarkLoading(true);
    setBookmarkError("");
    setBookmarkSaved(false);
    try {
      const saved = await saveReaderBookBookmark(bookId, { pageNumber: Number(bookmarkPage), note: bookmarkNote });
      setBookmark(saved);
      setBookmarkPage(String(saved.pageNumber));
      setBookmarkNote(saved.note || "");
      setBookmarkSaved(true);
    } catch {
      setBookmarkError(t.readerBookmarkError);
    } finally {
      setBookmarkLoading(false);
    }
  }

  async function removeBookmark() {
    if (bookmarkLoading) return;
    setBookmarkLoading(true);
    setBookmarkError("");
    setBookmarkSaved(false);
    try {
      await deleteReaderBookBookmark(bookId);
      setBookmark(null);
      setBookmarkPage("");
      setBookmarkNote("");
    } catch {
      setBookmarkError(t.readerBookmarkError);
    } finally {
      setBookmarkLoading(false);
    }
  }

  if (loading) return <main className="reader-page"><p>{t.loadingAccount}</p></main>;
  if (!user) return <Navigate to="/reader/login" replace />;

  const title = book?.title?.[language] || book?.title?.en || "";
  const source = "/api/v1/books/" + encodeURIComponent(bookId || "") + "/read";
  const bookmarkedSource = bookmark ? source + "#page=" + bookmark.pageNumber : source;
  return (
    <main className="reader-page">
      <style>{styles}</style>
      <div className="reader-toolbar">
        <Link to="/library"><ArrowLeft size={15} />{t.readerBackLibrary}</Link>
        {book && <a className="reader-open-link" href={bookmarkedSource} target="_blank" rel="noreferrer">{bookmark ? t.readerOpenBookmark : t.readerOpenTab}<ExternalLink size={14} /></a>}
      </div>
      {pageLoading ? <p className="reader-loading" aria-live="polite">{t.readerLoading}</p> : error ? (
        <div className="reader-error" role="alert"><h1>{t.readerPageTitle}</h1><p>{error}</p><Link to="/library">{t.readerBackLibrary}</Link></div>
      ) : book && (
        <>
          <h1 className="reader-book-heading">{title}</h1>
          <p className="reader-book-meta">{t.by} {book.author} · {book.accessKind === "free" ? t.libraryFreeLabel : t.libraryPurchasedLabel}</p>
          <form className="reader-bookmark" onSubmit={saveBookmark}>
            <label className="reader-bookmark-field">
              {t.readerBookmarkPage}
              <input type="number" min="1" max="100000" step="1" required value={bookmarkPage} onChange={(event) => { setBookmarkPage(event.target.value); setBookmarkSaved(false); }} />
            </label>
            <label className="reader-bookmark-field">
              {t.readerBookmarkNote}
              <input type="text" maxLength="160" value={bookmarkNote} onChange={(event) => { setBookmarkNote(event.target.value); setBookmarkSaved(false); }} />
            </label>
            <div className="reader-bookmark-actions">
              <button type="submit" disabled={bookmarkLoading}>{bookmarkLoading ? t.readerBookmarkSaving : <><Bookmark size={14} />{t.readerBookmarkSave}</>}</button>
              {bookmark && <button type="button" onClick={removeBookmark} disabled={bookmarkLoading}><Trash2 size={14} />{t.readerBookmarkRemove}</button>}
            </div>
            <p className="reader-bookmark-hint">{t.readerBookmarkHint}</p>
            {bookmarkSaved && <p className="reader-bookmark-status" role="status">{t.readerBookmarkSaved}</p>}
            {bookmarkError && <p className="reader-bookmark-error" role="alert">{bookmarkError}</p>}
          </form>
          <iframe key={bookmark?.pageNumber || "start"} className="reader-frame" src={bookmarkedSource} title={title || t.readerPageTitle} referrerPolicy="no-referrer" />
        </>
      )}
    </main>
  );
}