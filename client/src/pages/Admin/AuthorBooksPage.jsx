import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { decideAuthorBook, getSubmittedAuthorBookChapters, getSubmittedAuthorBooks } from "../../services/adminBookService.js";

const LANGUAGE_KEYS = { Gujarati: "gu", Hindi: "hi", English: "en" };
const styles = `
.admin-books{max-width:1080px;min-height:70vh;margin:auto;padding:54px 22px 90px}
.admin-books h1{font:500 clamp(34px,5vw,48px)/1.1 var(--serif);color:#30252c}
.admin-books-intro{max-width:720px;color:#77716a;font-size:12px;line-height:1.8}
.admin-books-toolbar{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0}
.admin-books-toolbar a{color:#796747;font-size:11px}
.admin-book-card{margin:14px 0;padding:22px;border:1px solid #e4ddd1;background:#fffdfa}
.admin-book-card h2{margin:0;font:500 25px var(--serif)}
.admin-book-meta,.admin-book-description{color:#77716a;font-size:11px;line-height:1.8;white-space:pre-wrap}
.admin-book-note{display:grid;gap:6px;margin-top:14px;color:#514a44;font-size:11px}
.admin-book-note input{min-height:40px;padding:9px 12px;border:1px solid #d8d0c4}
.admin-book-actions{display:flex;gap:10px;margin-top:14px}
.admin-book-actions button{min-height:38px;padding:0 14px;border:1px solid #30252c;background:#30252c;color:#fff;cursor:pointer}
.admin-book-actions button.secondary{background:transparent;color:#30252c}
.admin-book-actions button:disabled{opacity:.55}
.admin-book-message{padding:12px;background:#fbf3df;color:#6c542a;font-size:11px;line-height:1.7}
.admin-book-error{padding:12px;background:#f8ece8;color:#863d32;font-size:11px}
.admin-book-empty{color:#77716a;font-size:12px}
`;
function localizedText(value, language) {
  return value?.[LANGUAGE_KEYS[language]] || value?.en || value?.gu || value?.hi || "";
}

export default function AuthorBooksAdminPage() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const [books, setBooks] = useState([]);
  const [notes, setNotes] = useState({});
  const [busyId, setBusyId] = useState("");
  const [expandedBookId, setExpandedBookId] = useState("");
  const [chaptersByBook, setChaptersByBook] = useState({});
  const [chapterLoadingId, setChapterLoadingId] = useState("");
  const [error, setError] = useState("");

  async function loadBooks() {
    setError("");
    try {
      const result = await getSubmittedAuthorBooks();
      setBooks(result.books || []);
    } catch {
      setError(t.bookReviewError);
    }
  }

  useEffect(() => {
    if (user?.role === "admin") loadBooks();
  }, [user?.id, user?.role]);

  if (loading) return <main className="admin-books"><p>{t.loadingAccount}</p></main>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "admin") return <main className="admin-books"><h1>{t.adminOnly}</h1><Link to="/">{t.backHome}</Link></main>;

  async function toggleChapters(book) {
    if (expandedBookId === book.id) { setExpandedBookId(""); return; }
    setExpandedBookId(book.id);
    if (chaptersByBook[book.id]) return;
    setChapterLoadingId(book.id);
    try {
      const result = await getSubmittedAuthorBookChapters(book.id);
      setChaptersByBook((current) => ({ ...current, [book.id]: result.chapters || [] }));
    } catch {
      setError(t.bookReviewError);
      setExpandedBookId("");
    } finally {
      setChapterLoadingId("");
    }
  }

  async function review(book, decision) {
    setBusyId(book.id); setError("");
    try {
      await decideAuthorBook(book.id, { decision, adminNote: notes[book.id] || "" });
      await loadBooks();
    } catch {
      setError(t.bookReviewError);
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="admin-books">
      <style>{styles}</style>
      <div className="eyebrow"><i />{t.adminPortal}</div>
      <h1>{t.adminBookReviewTitle}</h1>
      <p className="admin-books-intro">{t.adminBookReviewIntro}</p>
      <nav className="admin-books-toolbar" aria-label={t.adminPortal}>
        <Link to="/admin">{t.adminDashboardTitle}</Link>
        <button type="button" onClick={loadBooks}>{t.viewAll}</button>
      </nav>
      <p className="admin-book-message" role="note">{t.manuscriptUploadPending}</p>
      {error && <p className="admin-book-error" role="alert">{error}</p>}
      {!books.length && !error && <p className="admin-book-empty">{t.noBooksPendingReview}</p>}
      {books.map((book) => (
        <article className="admin-book-card" key={book.id}>
          <h2>{localizedText(book.title, book.language)}</h2>
          <p className="admin-book-meta">{book.authorName} · {book.author?.displayName} · {book.author?.email}</p>
          <p className="admin-book-meta">{t.bookLanguage}: {t.bookLanguages[book.language]} · {t.bookCategory}: {t.categories[book.category] || book.category} · {t.bookPriceInr}: ₹{Number(book.price).toFixed(2)}</p>
          <p className="admin-book-description">{localizedText(book.description, book.language)}</p>
          <div className="admin-book-meta">
            {book.assets?.cover && <p><a href={`/api/v1/admin/author-books/${encodeURIComponent(book.id)}/assets/cover`} target="_blank" rel="noreferrer">{t.adminViewCover}: {book.assets.cover.fileName}</a></p>}
            {book.assets?.manuscript && <p><a href={`/api/v1/admin/author-books/${encodeURIComponent(book.id)}/assets/manuscript`} target="_blank" rel="noreferrer">{t.adminViewManuscript}: {book.assets.manuscript.fileName}</a></p>}
          </div>
          <button type="button" disabled={chapterLoadingId === book.id} onClick={() => toggleChapters(book)}>
            {chapterLoadingId === book.id ? t.loadingChapters : expandedBookId === book.id ? t.hideChapters : t.viewChapters}
          </button>
          {expandedBookId === book.id && <section aria-label={t.bookChapters}>
            <p className="admin-book-meta">{t.chapterPrivacyNote}</p>
            {!chaptersByBook[book.id]?.length ? <p className="admin-book-meta">{t.noChapters}</p> : chaptersByBook[book.id].map((chapter) => (
              <article className="admin-book-card" key={chapter.id}>
                <h3>{chapter.order}. {chapter.title}</h3>
                <p className="admin-book-description">{chapter.content}</p>
              </article>
            ))}
          </section>}
          <label className="admin-book-note">{t.adminBookNote}
            <input value={notes[book.id] || ""} maxLength={800} onChange={(event) => setNotes((current) => ({ ...current, [book.id]: event.target.value }))} />
          </label>
          <div className="admin-book-actions">
            <button type="button" disabled={Boolean(busyId)} onClick={() => review(book, "approved")}>{busyId === book.id ? t.savingChanges : t.approveBook}</button>
            <button type="button" className="secondary" disabled={Boolean(busyId)} onClick={() => review(book, "rejected")}>{t.rejectBook}</button>
          </div>
        </article>
      ))}
    </main>
  );
}
