import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { createBlogPost, getAdminBlogPosts, updateBlogPost } from "../../services/blogService.js";

const LANGUAGES = ["en", "gu", "hi"];
const blankGroup = () => ({ en: "", gu: "", hi: "" });
const blankPost = () => ({ slug: "", title: blankGroup(), summary: blankGroup(), body: blankGroup(), seoTitle: blankGroup(), seoDescription: blankGroup(), status: "draft" });
const styles = `
.admin-blog{max-width:1120px;min-height:70vh;margin:auto;padding:54px 22px 90px}
.admin-blog h1{font:500 clamp(34px,5vw,48px)/1.1 var(--serif);color:#30252c}
.admin-blog-intro,.admin-blog-meta{color:#77716a;font-size:11px;line-height:1.8}
.admin-blog-layout{display:grid;grid-template-columns:minmax(220px,.65fr) minmax(0,1.35fr);gap:16px;margin-top:22px}
.admin-blog-list,.admin-blog-editor{padding:20px;border:1px solid #e4ddd1;background:#fffdfa}
.admin-blog-list h2,.admin-blog-editor h2{margin:0 0 14px;font:500 22px var(--serif);color:#30252c}
.admin-blog-item{display:grid;width:100%;gap:4px;margin:8px 0;padding:12px;text-align:left;border:1px solid #e4ddd1;background:white;color:#30252c;cursor:pointer}
.admin-blog-item[aria-current=true]{border-color:#a8844b;background:#f8f6f1}
.admin-blog-item small{color:#77716a}
.admin-blog-editor{display:grid;gap:14px}
.admin-blog-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;border:0;padding:0}
.admin-blog-fields legend{margin-bottom:8px;color:#30252c;font-weight:600}
.admin-blog-field{display:grid;gap:5px;color:#77716a;font-size:11px}
.admin-blog-field input,.admin-blog-field select,.admin-blog-field textarea{width:100%;min-height:40px;padding:9px 10px;border:1px solid #d8d0c4;background:white;color:#30252c;font:12px/1.6 var(--sans)}
.admin-blog-field textarea{min-height:130px;resize:vertical}
.admin-blog-field.body textarea{min-height:240px}
.admin-blog-actions{display:flex;flex-wrap:wrap;gap:10px}
.admin-blog-actions button{min-height:40px;padding:0 15px;border:1px solid #30252c;background:#30252c;color:white;cursor:pointer}
.admin-blog-actions button:disabled{opacity:.5}
.admin-blog-error{padding:12px;background:#f8ece8;color:#863d32;font-size:11px}
.admin-blog-success{padding:12px;background:#eef5ed;color:#426c50;font-size:11px}
@media(max-width:760px){.admin-blog-layout{grid-template-columns:1fr}.admin-blog-fields{grid-template-columns:1fr}}
`;

export default function AdminBlogPostsPage() {
  const { user, loading } = useAuth();
  const { language, t } = useLanguage();
  const [posts, setPosts] = useState([]);
  const [draft, setDraft] = useState(blankPost);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setError("");
    try {
      const result = await getAdminBlogPosts();
      setPosts(result.posts || []);
    } catch {
      setError(t.blogAdminError);
    }
  }

  useEffect(() => { if (user?.role === "admin") load(); }, [user?.id, user?.role, t.blogAdminError]);

  if (loading) return <main className="admin-blog"><p>{t.loadingAccount}</p></main>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "admin") return <main className="admin-blog"><h1>{t.adminOnly}</h1><Link to="/">{t.backHome}</Link></main>;

  function selectPost(post) {
    setSelectedSlug(post.slug);
    setDraft({ slug: post.slug, title: post.title, summary: post.summary, body: post.body, seoTitle: post.seoTitle, seoDescription: post.seoDescription, status: post.status });
    setNotice("");
  }

  function change(field, value, language = "") {
    setDraft((current) => language ? { ...current, [field]: { ...current[field], [language]: value } } : { ...current, [field]: value });
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const result = selectedSlug ? await updateBlogPost(selectedSlug, draft) : await createBlogPost(draft);
      const saved = result.post;
      setSelectedSlug(saved.slug);
      setDraft({ slug: saved.slug, title: saved.title, summary: saved.summary, body: saved.body, seoTitle: saved.seoTitle, seoDescription: saved.seoDescription, status: saved.status });
      setNotice(t.blogPostSaved);
      await load();
    } catch (saveError) {
      setError(saveError.code === "BLOG_POST_TRANSLATIONS_REQUIRED" ? t.blogPostTranslationsRequired : t.blogAdminError);
    } finally {
      setBusy(false);
    }
  }

  function startNew() {
    setSelectedSlug("");
    setDraft(blankPost());
    setNotice("");
    setError("");
  }

  return (
    <main className="admin-blog">
      <style>{styles}</style>
      <div className="eyebrow"><i />{t.adminPortal}</div>
      <h1>{t.blogAdminTitle}</h1>
      <p className="admin-blog-intro">{t.blogAdminIntro}</p>
      <nav className="admin-blog-meta"><Link to="/admin">{t.adminDashboardTitle}</Link> · {t.blogPlainTextNotice}</nav>
      {error && <p className="admin-blog-error" role="alert">{error}</p>}
      {notice && <p className="admin-blog-success" role="status">{notice}</p>}
      <div className="admin-blog-layout">
        <aside className="admin-blog-list">
          <h2>{t.blogAdminTitle}</h2>
          <button type="button" onClick={startNew}>{t.blogPostNew}</button>
          {!posts.length && <p>{t.blogPostsEmpty}</p>}
          {posts.map((post) => <button className="admin-blog-item" type="button" aria-current={selectedSlug === post.slug} key={post.slug} onClick={() => selectPost(post)}>
            <strong>{post.title?.[language] || post.title?.en || post.slug}</strong>
            <small>/{post.slug} · {post.status === "published" ? t.blogPostPublished : t.blogPostDraft}</small>
          </button>)}
        </aside>
        <form className="admin-blog-editor" onSubmit={save}>
          <h2>{selectedSlug ? t.blogPostEdit : t.blogPostNew}</h2>
          <label className="admin-blog-field">{t.blogPostSlug}<input required disabled={Boolean(selectedSlug)} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={100} value={draft.slug} onChange={(event) => change("slug", event.target.value)} /></label>
          {[
            ["title", t.blogPostTitle, 200],
            ["summary", t.blogPostSummary, 600],
            ["body", t.blogPostBody, 20000],
            ["seoTitle", t.cmsPageSeoTitle, 70],
            ["seoDescription", t.cmsPageSeoDescription, 320],
          ].map(([field, label, limit]) => <fieldset className="admin-blog-fields" key={field}>
            <legend>{label}</legend>
            {LANGUAGES.map((lang) => <label className={field === "body" ? "admin-blog-field body" : "admin-blog-field"} key={lang}>{lang.toUpperCase()}
              {field === "body" || field === "summary"
                ? <textarea required={draft.status === "published" && ["body", "summary"].includes(field)} maxLength={limit} value={draft[field][lang] || ""} onChange={(event) => change(field, event.target.value, lang)} />
                : <input maxLength={limit} required={field === "title" && draft.status === "published"} value={draft[field][lang] || ""} onChange={(event) => change(field, event.target.value, lang)} />}
            </label>)}
          </fieldset>)}
          <label className="admin-blog-field">{t.blogPostStatus}<select value={draft.status} onChange={(event) => change("status", event.target.value)}><option value="draft">{t.blogPostDraft}</option><option value="published">{t.blogPostPublished}</option></select></label>
          <div className="admin-blog-actions"><button type="submit" disabled={busy}>{busy ? t.savingChanges : t.saveChanges}</button><button type="button" onClick={startNew}>{t.blogPostNew}</button></div>
        </form>
      </div>
    </main>
  );
}
