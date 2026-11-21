import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useCategories } from "../../hooks/useCategories.js";
import { useLanguage } from "../../hooks/useLanguage.js";
import { createCategory, getAdminCategories, updateCategory } from "../../services/categoryService.js";

const emptyLabels = () => ({ en: "", gu: "", hi: "" });
const styles = `
.admin-categories{max-width:1050px;min-height:70vh;margin:auto;padding:54px 22px 90px}
.admin-categories h1{font:500 clamp(34px,5vw,48px)/1.1 var(--serif);color:#30252c}
.admin-categories-intro{max-width:760px;color:#77716a;font-size:12px;line-height:1.8}
.admin-categories-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:20px 0;color:#796747;font-size:11px}
.admin-category-card,.admin-category-create{margin:14px 0;padding:20px;border:1px solid #e4ddd1;background:#fffdfa}
.admin-category-card h2,.admin-category-create h2{margin:0 0 14px;font:500 22px var(--serif);color:#30252c}
.admin-category-form{display:grid;grid-template-columns:minmax(130px,.6fr) minmax(0,2fr) 110px auto;align-items:end;gap:12px}
.admin-category-field{display:grid;gap:5px;color:#77716a;font-size:11px}
.admin-category-field input{width:100%;min-height:40px;padding:8px 10px;border:1px solid #d8d0c4;background:white;color:#30252c}
.admin-category-labels{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.admin-category-usage{grid-column:1/-1;color:#77716a;font-size:10px}
.admin-category-form button{min-height:40px;padding:0 14px;border:1px solid #30252c;background:#30252c;color:white;cursor:pointer}
.admin-category-form button:disabled{opacity:.5;cursor:not-allowed}
.admin-category-error{padding:12px;background:#f8ece8;color:#863d32;font-size:11px}
.admin-category-success{padding:12px;background:#eef5ed;color:#426c50;font-size:11px}
@media(max-width:760px){.admin-category-form{grid-template-columns:1fr}.admin-category-labels{grid-template-columns:1fr}.admin-category-usage{grid-column:auto}}
`;

export default function AdminCategoriesPage() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const { refreshCategories } = useCategories();
  const [categories, setCategories] = useState([]);
  const [edits, setEdits] = useState({});
  const [form, setForm] = useState({ key: "", labels: emptyLabels(), sortOrder: 100 });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setError("");
    try {
      const result = await getAdminCategories();
      setCategories(result);
      setEdits({});
    } catch {
      setError(t.adminCategoryError);
    }
  }

  useEffect(() => {
    if (user?.role === "admin") load();
  }, [user?.id, user?.role, t.adminCategoryError]);

  if (loading) return <main className="admin-categories"><p>{t.loadingAccount}</p></main>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "admin") return <main className="admin-categories"><h1>{t.adminOnly}</h1><Link to="/">{t.backHome}</Link></main>;

  function edit(category, field, value, language = "") {
    setEdits((current) => {
      const draft = current[category.key] || { labels: category.labels, sortOrder: category.sortOrder, active: category.active };
      return {
        ...current,
        [category.key]: language
          ? { ...draft, labels: { ...draft.labels, [language]: value } }
          : { ...draft, [field]: value },
      };
    });
  }

  async function save(category) {
    const draft = edits[category.key] || { labels: category.labels, sortOrder: category.sortOrder, active: category.active };
    setBusy(category.key); setError(""); setNotice("");
    try {
      await updateCategory(category.key, { labels: draft.labels, sortOrder: Number(draft.sortOrder), active: draft.active });
      await refreshCategories();
      setNotice(t.adminCategorySaved);
      await load();
    } catch (saveError) {
      setError(saveError.code === "CATEGORY_IN_USE" ? t.adminCategoryInUse : t.adminCategoryError);
    } finally {
      setBusy("");
    }
  }

  async function add(event) {
    event.preventDefault();
    setBusy("new"); setError(""); setNotice("");
    try {
      await createCategory({ ...form, sortOrder: Number(form.sortOrder) });
      setForm({ key: "", labels: emptyLabels(), sortOrder: 100 });
      await refreshCategories();
      setNotice(t.adminCategoryCreated);
      await load();
    } catch {
      setError(t.adminCategoryError);
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="admin-categories">
      <style>{styles}</style>
      <div className="eyebrow"><i />{t.adminPortal}</div>
      <h1>{t.adminCategoriesTitle}</h1>
      <p className="admin-categories-intro">{t.adminCategoriesIntro}</p>
      <div className="admin-categories-toolbar"><Link to="/admin">{t.adminDashboardTitle}</Link><span>{categories.length} {t.adminCategoriesCount}</span></div>
      {error && <p className="admin-category-error" role="alert">{error}</p>}
      {notice && <p className="admin-category-success" role="status">{notice}</p>}
      <form className="admin-category-create" onSubmit={add}>
        <h2>{t.adminCategoryAdd}</h2>
        <div className="admin-category-form">
          <label className="admin-category-field">{t.adminCategoryKey}<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={50} value={form.key} onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))} /></label>
          <div className="admin-category-labels">{["en", "gu", "hi"].map((language) => <label className="admin-category-field" key={language}>{language.toUpperCase()}<input required maxLength={80} value={form.labels[language]} onChange={(event) => setForm((current) => ({ ...current, labels: { ...current.labels, [language]: event.target.value } }))} /></label>)}</div>
          <label className="admin-category-field">{t.adminCategoryOrder}<input type="number" min="0" max="10000" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} /></label>
          <button type="submit" disabled={Boolean(busy)}>{busy === "new" ? t.savingChanges : t.adminCategoryAdd}</button>
        </div>
      </form>
      {categories.map((category) => {
        const draft = edits[category.key] || { labels: category.labels, sortOrder: category.sortOrder, active: category.active };
        const used = category.usage.catalogueBooks + category.usage.authorBooks;
        return <form className="admin-category-card" key={category.key} onSubmit={(event) => { event.preventDefault(); save(category); }}>
          <h2>{category.key}</h2>
          <div className="admin-category-form">
            <label className="admin-category-field">{t.adminCategoryOrder}<input type="number" min="0" max="10000" value={draft.sortOrder} onChange={(event) => edit(category, "sortOrder", event.target.value)} /></label>
            <div className="admin-category-labels">{["en", "gu", "hi"].map((language) => <label className="admin-category-field" key={language}>{language.toUpperCase()}<input required maxLength={80} value={draft.labels[language]} onChange={(event) => edit(category, "labels", event.target.value, language)} /></label>)}</div>
            <label className="admin-category-field">{t.adminCategoryStatus}<select value={draft.active ? "active" : "inactive"} disabled={used > 0} onChange={(event) => edit(category, "active", event.target.value === "active")}><option value="active">{t.adminCategoryActive}</option><option value="inactive">{t.adminCategoryInactive}</option></select></label>
            <button type="submit" disabled={Boolean(busy)}>{busy === category.key ? t.savingChanges : t.saveChanges}</button>
            <span className="admin-category-usage">{t.adminCategoryUsage}: {category.usage.catalogueBooks} · {category.usage.authorBooks} {t.adminCategoryAuthorBooks}{used > 0 ? ` · ${t.adminCategoryInUse}` : ""}</span>
          </div>
        </form>;
      })}
    </main>
  );
}
