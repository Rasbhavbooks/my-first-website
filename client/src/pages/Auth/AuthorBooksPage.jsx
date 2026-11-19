import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { createAuthorBookDraft, getMyAuthorBooks, saveAuthorBookDraft, submitAuthorBook, uploadAuthorBookAsset } from "../../services/authorBookService.js";

const LANGUAGE_KEYS = { Gujarati: "gu", Hindi: "hi", English: "en" };
const LOCALE_NAMES = { en: "English", gu: "ગુજરાતી", hi: "हिन्दी" };
const blankLocalized = () => ({ en: "", gu: "", hi: "" });
const blankBook = () => ({
  title: blankLocalized(),
  description: blankLocalized(),
  language: "English",
  category: "Novel",
  price: 0,
  status: "draft",
});

const styles = `
.author-books{max-width:1100px;min-height:70vh;margin:auto;padding:54px 22px 90px}
.author-books h1{font:500 clamp(34px,5vw,48px)/1.1 var(--serif);color:#30252c}
.author-books-intro{max-width:720px;color:#77716a;font-size:12px;line-height:1.8}
.author-books-layout{display:grid;grid-template-columns:minmax(220px,.7fr) minmax(0,1.3fr);gap:18px;margin-top:24px}
.author-books-list,.author-books-editor{padding:22px;border:1px solid #e4ddd1;background:#fffdfa}
.author-books-list h2,.author-books-editor h2{margin:0 0 16px;font:500 23px var(--serif);color:#30252c}
.author-book-row{display:grid;width:100%;gap:6px;margin:8px 0;padding:13px;text-align:left;border:1px solid #e4ddd1;background:#fff;color:#30252c;cursor:pointer}
.author-book-row[aria-current=true]{border-color:#a8844b;background:#f8f6f1}
.author-book-row small{color:#77716a}
.author-book-form{display:grid;gap:15px}
.author-book-field{display:grid;gap:7px;color:#514a44;font-size:11px;font-weight:600}
.author-book-field input,.author-book-field select,.author-book-field textarea{width:100%;min-height:43px;padding:10px 12px;border:1px solid #d8d0c4;background:white;color:#30252c;font:12px/1.6 var(--sans)}
.author-book-field textarea{min-height:160px;resize:vertical}
.author-book-hint{margin:0;color:#77716a;font-size:10px;line-height:1.7}
.author-book-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.author-book-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:4px}
.author-book-actions button,.author-book-new{min-height:42px;padding:0 16px;border:1px solid #30252c;background:#30252c;color:white;font-size:11px;cursor:pointer}
.author-book-actions button.secondary{background:transparent;color:#30252c}
.author-book-actions button:disabled,.author-book-new:disabled{opacity:.55;cursor:wait}
.author-book-notice,.author-book-error,.author-book-warning{padding:12px;margin:12px 0;font-size:11px;line-height:1.7}
.author-book-notice{background:#edf3e9;color:#39513d}.author-book-error{background:#f8ece8;color:#863d32}
.author-book-warning{background:#fbf3df;color:#6c542a}
.author-book-admin-note{color:#863d32;font-size:11px;line-height:1.7}
.author-books-back{display:inline-block;margin:0 0 12px;color:#796747;font-size:11px}
.author-books-empty{color:#77716a;font-size:12px;line-height:1.8}
@media(max-width:720px){.author-books-layout{grid-template-columns:1fr}.author-book-grid{grid-template-columns:1fr}.author-books{padding:36px 16px 70px}}
`;

function firstText(localized) {
  return localized?.en || localized?.gu || localized?.hi || "";
}

export default function AuthorBooksPage() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const [books, setBooks] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(blankBook);
  const [pageLoading, setPageLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function reload() {
    const result = await getMyAuthorBooks();
    setBooks(result.books || []);
    return result.books || [];
  }

  useEffect(() => {
    if (user?.role !== "author") return;
    getMyAuthorBooks()
      .then((result) => setBooks(result.books || []))
      .catch(() => setError(t.authorBookError))
      .finally(() => setPageLoading(false));
  }, [user?.id, user?.role, t.authorBookError]);

  if (loading) return <main className="author-books"><p>{t.loadingAccount}</p></main>;
  if (!user) return <Navigate to="/author/login" replace />;
  if (user.role !== "author") return <Navigate to="/author/apply" replace />;

  function chooseBook(book) {
    setSelectedId(book.id);
    setForm({ ...book, title: { ...book.title }, description: { ...book.description } });
    setError("");
    setNotice("");
  }

  async function createDraft() {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await createAuthorBookDraft();
      const book = result.book;
      setBooks((current) => [book, ...current]);
      chooseBook(book);
    } catch {
      setError(t.authorBookError);
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft(event) {
    event.preventDefault();
    if (!selectedId) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await saveAuthorBookDraft(selectedId, form);
      const book = result.book;
      setForm({ ...book, title: { ...book.title }, description: { ...book.description } });
      setBooks((current) => current.map((item) => item.id === book.id ? book : item));
      setNotice(t.bookDraftSaved);
    } catch {
      setError(t.authorBookError);
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(assetType, file) {
    if (!file || !selectedId) return;
    setUploadingAsset(assetType); setError(""); setNotice("");
    try {
      const result = await uploadAuthorBookAsset(selectedId, assetType, file);
      setForm((current) => ({ ...current, assets: result.book.assets }));
      setBooks((current) => current.map((item) => item.id === selectedId ? result.book : item));
      setNotice(t.assetUploaded);
    } catch (uploadError) {
      const messages = {
        FILE_SCANNER_NOT_CONFIGURED: t.assetScannerUnavailable,
        FILE_SCANNER_UNAVAILABLE: t.assetScannerUnavailable,
        FILE_SCANNER_TIMEOUT: t.assetScannerUnavailable,
        FILE_SCAN_FAILED: t.assetScannerUnavailable,
        STORAGE_NOT_CONFIGURED: t.assetStorageUnavailable,
        MALWARE_DETECTED: t.assetMalwareDetected,
        INVALID_FILE_SIZE: t.assetInvalidSize,
        INVALID_FILE_TYPE: t.assetInvalidType,
      };
      setError(messages[uploadError.code] || t.authorBookError);
    } finally {
      setUploadingAsset("");
    }
  }

  async function sendForReview() {
    if (!selectedId) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const saved = await saveAuthorBookDraft(selectedId, form);
      const submitted = await submitAuthorBook(saved.book.id);
      setForm({ ...submitted.book, title: { ...submitted.book.title }, description: { ...submitted.book.description } });
      await reload();
      setNotice(t.bookSubmitted);
    } catch (requestError) {
      setError(requestError.code === "AUTHOR_BOOK_ASSETS_REQUIRED" ? t.bookFilesRequired : requestError.code === "AUTHOR_BOOK_INCOMPLETE" || requestError.code === "INVALID_AUTHOR_BOOK" ? t.bookSubmissionIncomplete : t.authorBookError);
    } finally {
      setBusy(false);
    }
  }

  const editable = ["draft", "rejected"].includes(form.status);
  const contentKey = LANGUAGE_KEYS[form.language] || "en";
  const categories = Object.entries(t.categories || {}).filter(([key]) => key !== "All");

  return (
    <main className="author-books">
      <style>{styles}</style>
      <Link className="author-books-back" to="/author/studio">← {t.authorStudio}</Link>
      <div className="eyebrow"><i />{t.forAuthors}</div>
      <h1>{t.authorBooksTitle}</h1>
      <p className="author-books-intro">{t.authorBooksIntro}</p>
      <p className="author-book-warning" role="note">{t.manuscriptUploadPending}</p>
      {uploadingAsset && <p className="author-book-notice" role="status">{t.uploadingFile}</p>}
      {notice && <p className="author-book-notice" role="status">{notice}</p>
      {error && <p className="author-book-error" role="alert">{error}</p>}
      <div className="author-books-layout">
        <section className="author-books-list" aria-labelledby="author-book-list-title">
          <h2 id="author-book-list-title">{t.booksInStudio}</h2>
          <button className="author-book-new" type="button" disabled={busy || pageLoading} onClick={createDraft}>{t.newAuthorBook}</button>
          {pageLoading ? <p className="author-books-empty">{t.loadingAccount}</p> : books.length === 0 ? <p className="author-books-empty">{t.noAuthorBooks}</p> : books.map((book) => (
            <button className="author-book-row" type="button" key={book.id} aria-current={selectedId === book.id} onClick={() => chooseBook(book)}>
              <strong>{firstText(book.title) || t.newAuthorBook}</strong>
              <small>{t[`bookStatus${book.status[0].toUpperCase()}${book.status.slice(1)}`] || book.status}</small>
            </button>
          ))}
        </section>
        <section className="author-books-editor" aria-labelledby="author-book-editor-title">
          <h2 id="author-book-editor-title">{selectedId ? firstText(form.title) || t.newAuthorBook : t.chooseBookDraft}</h2>
          {!selectedId ? <p className="author-books-empty">{t.createBookDraftPrompt}</p> : (
            <>
              {form.adminNote && <p className="author-book-admin-note">{t.adminNote}: {form.adminNote}</p>}
              {!editable && <p className="author-book-notice">{t.bookSubmitted}</p>}
              <form className="author-book-form" onSubmit={saveDraft}>
                <div className="author-book-grid">
                  <label className="author-book-field">{t.bookLanguage}
                    <select value={form.language} disabled={!editable} onChange={(event) => setForm((current) => ({ ...current, language: event.target.value }))}>
                      <option value="Gujarati">{t.bookLanguages.Gujarati}</option>
                      <option value="Hindi">{t.bookLanguages.Hindi}</option>
                      <option value="English">{t.bookLanguages.English}</option>
                    </select>
                  </label>
                  <label className="author-book-field">{t.bookCategory}
                    <select value={form.category} disabled={!editable} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
                      {categories.map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                    </select>
                  </label>
                </div>
                <label className="author-book-field">{t.bookTitle} · {LOCALE_NAMES[contentKey]}
                  <input value={form.title?.[contentKey] || ""} disabled={!editable} minLength={2} maxLength={160} onChange={(event) => setForm((current) => ({ ...current, title: { ...current.title, [contentKey]: event.target.value } }))} />
                </label>
                <label className="author-book-field">{t.bookSummary} · {LOCALE_NAMES[contentKey]}
                  <textarea value={form.description?.[contentKey] || ""} disabled={!editable} maxLength={4000} onChange={(event) => setForm((current) => ({ ...current, description: { ...current.description, [contentKey]: event.target.value } }))} />
                </label>
                <p className="author-book-hint">{t.bookSummaryHelp}</p>
                <label className="author-book-field">{t.coverFile}
                  <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" disabled={!editable || Boolean(uploadingAsset)} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; uploadFile("cover", file); }} />
                  <span className="author-book-hint">{form.assets?.cover ? `${form.assets.cover.fileName} · ${t.assetScanClean}` : t.assetSizeLimits}</span>
                </label>
                <label className="author-book-field">{t.manuscriptFile}
                  <input type="file" accept=".pdf,application/pdf" disabled={!editable || Boolean(uploadingAsset)} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; uploadFile("manuscript", file); }} />
                  <span className="author-book-hint">{form.assets?.manuscript ? `${form.assets.manuscript.fileName} · ${t.assetScanClean}` : t.assetSizeLimits}</span>
                </label>
                <label className="author-book-field">{t.bookPriceInr}
                  <input type="number" min="0" max="100000" step="0.01" value={form.price} disabled={!editable} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} />
                </label>
                {editable && <div className="author-book-actions">
                  <button type="submit" disabled={busy}>{busy ? t.savingChanges : t.saveBookDraft}</button>
                  <button type="button" className="secondary" disabled={busy} onClick={sendForReview}>{busy ? t.savingChanges : t.submitBookForReview}</button>
                </div>}
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
