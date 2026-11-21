import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { createCmsPage, getAdminCmsPages, updateCmsPage } from "../../services/cmsPageService.js";

const LANGUAGES = ["en", "gu", "hi"];
const blankGroup = () => ({ en: "", gu: "", hi: "" });
const blankPage = () => ({ slug: "", title: blankGroup(), body: blankGroup(), seoTitle: blankGroup(), seoDescription: blankGroup(), status: "draft" });
const styles = `
.admin-cms{max-width:1100px;min-height:70vh;margin:auto;padding:54px 22px 90px}
.admin-cms h1{font:500 clamp(34px,5vw,48px)/1.1 var(--serif);color:#30252c}
.admin-cms-intro,.admin-cms-meta{color:#77716a;font-size:11px;line-height:1.8}
.admin-cms-layout{display:grid;grid-template-columns:minmax(220px,.65fr) minmax(0,1.35fr);gap:16px;margin-top:22px}
.admin-cms-list,.admin-cms-editor{padding:20px;border:1px solid #e4ddd1;background:#fffdfa}
.admin-cms-list h2,.admin-cms-editor h2{margin:0 0 14px;font:500 22px var(--serif);color:#30252c}
.admin-cms-item{display:grid;width:100%;gap:4px;margin:8px 0;padding:12px;text-align:left;border:1px solid #e4ddd1;background:white;color:#30252c;cursor:pointer}
.admin-cms-item[aria-current=true]{border-color:#a8844b;background:#f8f6f1}
.admin-cms-item small{color:#77716a}
.admin-cms-editor{display:grid;gap:14px}
.admin-cms-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.admin-cms-field{display:grid;gap:5px;color:#77716a;font-size:11px}
.admin-cms-field input,.admin-cms-field select,.admin-cms-field textarea{width:100%;min-height:40px;padding:9px 10px;border:1px solid #d8d0c4;background:white;color:#30252c;font:12px/1.6 var(--sans)}
.admin-cms-field textarea{min-height:135px;resize:vertical}
.admin-cms-field.body textarea{min-height:220px}
.admin-cms-actions{display:flex;flex-wrap:wrap;gap:10px}
.admin-cms-actions button{min-height:40px;padding:0 15px;border:1px solid #30252c;background:#30252c;color:white;cursor:pointer}
.admin-cms-actions button:disabled{opacity:.5}
.admin-cms-error{padding:12px;background:#f8ece8;color:#863d32;font-size:11px}
.admin-cms-success{padding:12px;background:#eef5ed;color:#426c50;font-size:11px}
@media(max-width:760px){.admin-cms-layout{grid-template-columns:1fr}.admin-cms-fields{grid-template-columns:1fr}}
`;

export default function AdminCmsPagesPage() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const [pages, setPages] = useState([]);
  const [draft, setDraft] = useState(blankPage);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setError("");
    try {
      const result = await getAdminCmsPages();
      setPages(result.pages || []);
    } catch {
      setError(t.cmsPagesError);
    }
  }

  useEffect(() => {
    if (user?.role === "admin") load();
  }, [user?.id, user?.role, t.cmsPagesError]);

  if (loading) return <main className="admin-cms"><p>{t.loadingAccount}</p></main>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "admin") return <main className="admin-cms"><h1>{t.adminOnly}</h1><Link to="/">{t.backHome}</Link></main>;

  function selectPage(page) {
    setSelectedSlug(page.slug);
    setDraft({ slug: page.slug, title: page.title, body: page.body, seoTitle: page.seoTitle, seoDescription: page.seoDescription, status: page.status });
    setNotice("");
  }

  function change(field, value, language = "") {
    setDraft((current) => language
      ? { ...current, [field]: { ...current[field], [language]: value } }
      : { ...current, [field]: value });
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const result = selectedSlug
        ? await updateCmsPage(selectedSlug, draft)
        : await createCmsPage(draft);
      const saved = result.page;
      setSelectedSlug(saved.slug);
      setDraft({ slug: saved.slug, title: saved.title, body: saved.body, seoTitle: saved.seoTitle, seoDescription: saved.seoDescription, status: saved.status });
      setNotice(t.cmsPageSaved);
      await load();
    } catch (saveError) {
      setError(saveError.code === "CMS_PAGE_TRANSLATIONS_REQUIRED" ? t.cmsPageTranslationsRequired : t.cmsPagesError);
    } finally {
      setBusy(false);
    }
  }

  function startNew() {
    setSelectedSlug("");
    setDraft(blankPage());
    setNotice("");
    setError("");
  }

  return (
    <main className="admin-cms">
      <style>{styles}</style>
      <div className="eyebrow"><i />{t.adminPortal}</div>
      <h1>{t.cmsPagesTitle}</h1>
      <p className="admin-cms-intro">{t.cmsPagesIntro}</p>
      <nav className="admin-cms-meta"><Link to="/admin">{t.adminDashboardTitle}</Link> · {t.cmsPagesPlainTextNotice}</nav>
      {error && <p className="admin-cms-error" role="alert">{error}</p>}
      {notice && <p className="admin-cms-success" role="status">{notice}</p>}
      <div className="admin-cms-layout">
        <aside className="admin-cms-list">
          <h2>{t.cmsPagesTitle}</h2>
          <button type="button" onClick={startNew}>{t.cmsPageNew}</button>
          {!pages.length && <p>{t.cmsPagesEmpty}</p>}
          {pages.map((page) => <button className="admin-cms-item" type="button" aria-current={selectedSlug === page.slug} key={page.slug} onClick={() => selectPage(page)}>
            <strong>{page.title[t.language] || page.title.en || page.slug}</strong>
            <small>/{page.slug} · {page.status === "published" ? t.cmsPagePublished : t.cmsPageDraft}</small>
          </button>)}
        </aside>
        <form className="admin-cms-editor" onSubmit={save}>
          <h2>{selectedSlug ? t.cmsPageEdit : t.cmsPageNew}</h2>
          <label className="admin-cms-field">{t.cmsPageSlug}<input required disabled={Boolean(selectedSlug)} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={100} value={draft.slug} onChange={(event) => change("slug", event.target.value)} /></label>
          {[
            ["title", t.cmsPageTitle],
            ["body", t.cmsPageBody],
            ["seoTitle", t.cmsPageSeoTitle],
            ["seoDescription", t.cmsPageSeoDescription],
          ].map(([field, label]) => <fieldset className="admin-cms-fields" key={field}>
            <legend>{label}</legend>
            {LANGUAGES.map((language) => <label className={field === "body" ? "admin-cms-field body" : "admin-cms-field"} key={language}>{language.toUpperCase()}
              {field === "body"
                ? <textarea required={draft.status === "published"} maxLength={20000} value={draft[field][language]} onChange={(event) => change(field, event.target.value, language)} />
                : <input maxLength={field === "title" ? 200 : 320} required={field === "title" && draft.status === "published"} value={draft[field][language]} onChange={(event) => change(field, event.target.value, language)} />}
            </label>)}
          </fieldset>)}
          <label className="admin-cms-field">{t.cmsPageStatus}<select value={draft.status} onChange={(event) => change("status", event.target.value)}><option value="draft">{t.cmsPageDraft}</option><option value="published">{t.cmsPagePublished}</option></select></label>
          <div className="admin-cms-actions"><button type="submit" disabled={busy}>{busy ? t.savingChanges : t.saveChanges}</button><button type="button" onClick={startNew}>{t.cmsPageNew}</button></div>
        </form>
      </div>
    </main>
  );
}
