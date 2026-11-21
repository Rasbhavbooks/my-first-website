import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { categories } from "../../data/books.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { getAdminCatalogueBooks, updateAdminCatalogueBook } from "../../services/adminCatalogueService.js";

const LANGUAGES = ["en", "gu", "hi"];
const styles = `
.admin-catalogue{max-width:1100px;min-height:70vh;margin:auto;padding:54px 22px 90px}
.admin-catalogue h1{font:500 clamp(34px,5vw,48px)/1.1 var(--serif);color:#30252c}
.admin-catalogue-intro{max-width:740px;color:#77716a;font-size:12px;line-height:1.8}
.admin-catalogue-toolbar{display:flex;flex-wrap:wrap;align-items:end;gap:10px;margin:22px 0}
.admin-catalogue-toolbar label{display:grid;gap:5px;color:#77716a;font-size:11px}
.admin-catalogue-toolbar input,.admin-catalogue-toolbar select,.admin-catalogue-field input,.admin-catalogue-field select,.admin-catalogue-field textarea{width:100%;min-height:40px;padding:9px 11px;border:1px solid #d8d0c4;background:#fffdfa;color:#30252c}
.admin-catalogue-toolbar input,.admin-catalogue-toolbar select{min-width:210px}
.admin-catalogue-toolbar button,.admin-catalogue-save,.admin-catalogue-pagination button{min-height:40px;padding:0 14px;border:1px solid #30252c;background:transparent;color:#30252c;cursor:pointer}
.admin-catalogue-toolbar button:hover,.admin-catalogue-save:hover,.admin-catalogue-pagination button:hover{background:#30252c;color:white}
.admin-catalogue-toolbar button:disabled,.admin-catalogue-save:disabled,.admin-catalogue-pagination button:disabled{opacity:.5;cursor:not-allowed}
.admin-catalogue-card{margin:14px 0;padding:22px;border:1px solid #e4ddd1;background:#fffdfa}
.admin-catalogue-card h2{margin:0 0 14px;font:500 24px var(--serif);color:#30252c}
.admin-catalogue-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.admin-catalogue-field{display:grid;gap:5px;color:#77716a;font-size:11px}
.admin-catalogue-field.full{grid-column:1/-1}
.admin-catalogue-locale{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.admin-catalogue-save{margin-top:14px;background:#30252c;color:white}
.admin-catalogue-message{padding:12px;background:#eef5ed;color:#426c50;font-size:11px}
.admin-catalogue-error{padding:12px;background:#f8ece8;color:#863d32;font-size:11px}
.admin-catalogue-empty{padding:24px;border:1px solid #e4ddd1;color:#77716a}
.admin-catalogue-pagination{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:20px}
@media(max-width:650px){.admin-catalogue-toolbar>*{flex:1 1 100%}.admin-catalogue-fields,.admin-catalogue-locale{grid-template-columns:1fr}.admin-catalogue-field.full{grid-column:auto}}
`;

export default function AdminCataloguePage() {
  const { user, loading } = useAuth();
  const { language, t } = useLanguage();
  const [books, setBooks] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [filters, setFilters] = useState({ search: "", category: "" });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setError("");
    try {
      const result = await getAdminCatalogueBooks({ ...filters, page: String(page) });
      setBooks(result.books || []);
      setPagination(result.pagination || { total: 0, totalPages: 0 });
      setDrafts({});
    } catch {
      setError(t.adminCatalogueError);
    }
  }

  useEffect(() => {
    if (user?.role === "admin") load();
  }, [user?.id, user?.role, filters, page, t.adminCatalogueError]);

  if (loading) return <main className="admin-catalogue"><p>{t.loadingAccount}</p></main>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "admin") return <main className="admin-catalogue"><h1>{t.adminOnly}</h1><Link to="/">{t.backHome}</Link></main>;

  function search(event) {
    event.preventDefault();
    setNotice("");
    setPage(1);
    setFilters({ search: query.trim(), category });
  }

  function updateDraft(book, field, value, languageKey = "") {
    setDrafts((current) => {
      const draft = current[book.id] || book;
      const updated = languageKey
        ? { ...draft, [field]: { ...draft[field], [languageKey]: value } }
        : { ...draft, [field]: value };
      return { ...current, [book.id]: updated };
    });
  }

  async function save(book) {
    const draft = drafts[book.id] || book;
    setBusyId(book.id);
    setError("");
    setNotice("");
    try {
      const result = await updateAdminCatalogueBook(book.id, draft);
      setBooks((current) => current.map((item) => item.id === book.id ? result.book : item));
      setDrafts((current) => ({ ...current, [book.id]: result.book }));
      setNotice(t.adminCatalogueSaved);
    } catch {
      setError(t.adminCatalogueError);
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="admin-catalogue">
      <style>{styles}</style>
      <div className="eyebrow"><i />{t.adminPortal}</div>
      <h1>{t.adminCatalogueTitle}</h1>
      <p className="admin-catalogue-intro">{t.adminCatalogueIntro}</p>
      <nav className="admin-catalogue-toolbar" aria-label={t.adminPortal}>
        <Link to="/admin">{t.adminDashboardTitle}</Link>
      </nav>
      <form className="admin-catalogue-toolbar" onSubmit={search}>
        <label>{t.adminCatalogueSearch}<input value={query} maxLength={100} onChange={(event) => setQuery(event.target.value)} /></label>
        <label>{t.bookCategory}<select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">{t.adminUserAllStatuses}</option>
          {categories.filter((item) => item !== "All").map((item) => <option key={item} value={item}>{t.categories[item] || item}</option>)}
        </select></label>
        <button type="submit">{t.search}</button>
      </form>
      {error && <p className="admin-catalogue-error" role="alert">{error}</p>}
      {notice && <p className="admin-catalogue-message" role="status">{notice}</p>}
      {!books.length && !error ? <p className="admin-catalogue-empty">{t.adminCatalogueEmpty}</p> : books.map((book) => {
        const draft = drafts[book.id] || book;
        return <form className="admin-catalogue-card" key={book.id} onSubmit={(event) => { event.preventDefault(); save(book); }}>
          <h2>{draft.title[language] || draft.title.en}</h2>
          <div className="admin-catalogue-fields">
            <div className="admin-catalogue-field full"><span>{t.bookTitle}</span><div className="admin-catalogue-locale">{LANGUAGES.map((key) => <label key={key}>{key.toUpperCase()}<input required maxLength={200} value={draft.title[key] || ""} onChange={(event) => updateDraft(book, "title", event.target.value, key)} /></label>)}</div></div>
            <label className="admin-catalogue-field">{t.by}<input required maxLength={120} value={draft.author} onChange={(event) => updateDraft(book, "author", event.target.value)} /></label>
            <label className="admin-catalogue-field">{t.bookLanguage}<select value={draft.language} onChange={(event) => updateDraft(book, "language", event.target.value)}>{["Gujarati", "Hindi", "English"].map((item) => <option key={item} value={item}>{t.bookLanguages[item]}</option>)}</select></label>
            <label className="admin-catalogue-field">{t.bookCategory}<select value={draft.category} onChange={(event) => updateDraft(book, "category", event.target.value)}>{categories.filter((item) => item !== "All").map((item) => <option key={item} value={item}>{t.categories[item] || item}</option>)}</select></label>
            <label className="admin-catalogue-field">{t.bookPriceInr}<input type="number" min="0" max="100000" step="0.01" value={draft.price} onChange={(event) => updateDraft(book, "price", event.target.value)} /></label>
            <label className="admin-catalogue-field">{t.badge}<input required maxLength={40} value={draft.badge} onChange={(event) => updateDraft(book, "badge", event.target.value)} /></label>
            <label className="admin-catalogue-field">{t.bookTone}<input required maxLength={40} value={draft.tone} onChange={(event) => updateDraft(book, "tone", event.target.value)} /></label>
            <div className="admin-catalogue-field full"><span>{t.bookSummary}</span><div className="admin-catalogue-locale">{LANGUAGES.map((key) => <label key={key}>{key.toUpperCase()}<textarea required maxLength={4000} rows="4" value={draft.description[key] || ""} onChange={(event) => updateDraft(book, "description", event.target.value, key)} /></label>)}</div></div>
          </div>
          <button className="admin-catalogue-save" disabled={Boolean(busyId)} type="submit">{busyId === book.id ? t.savingChanges : t.saveChanges}</button>
        </form>;
      })}
      <div className="admin-catalogue-pagination">
        <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{t.previousPage}</button>
        <span>{t.adminUserPage} {page} / {Math.max(1, pagination.totalPages)}</span>
        <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>{t.nextPage}</button>
      </div>
    </main>
  );
}
