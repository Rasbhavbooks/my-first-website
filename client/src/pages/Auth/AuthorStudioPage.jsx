import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { getMyAuthorProfile, updateMyAuthorProfile } from "../../services/authorService.js";

const styles = `
.author-studio{max-width:880px;min-height:70vh;margin:auto;padding:58px 22px 90px}
.author-studio h1{font:500 clamp(34px,5vw,48px)/1.1 var(--serif);color:#30252c}
.author-studio-panel{margin-top:24px;padding:28px;border:1px solid #e4ddd1;background:#fffdfa}
.author-studio-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:20px}
.author-studio-stat{display:grid;gap:5px;padding:18px;border:1px solid #e4ddd1;background:#fffdfa}
.author-studio-stat strong{font:500 27px var(--serif);color:#30252c}
.author-studio-stat span{color:#77716a;font-size:10px}
@media(max-width:520px){.author-studio-stats{grid-template-columns:1fr}}
.author-studio-form{display:grid;gap:16px}
.author-studio-field{display:grid;gap:7px;color:#514a44;font-size:11px;font-weight:600}
.author-studio-field input,.author-studio-field textarea{width:100%;padding:12px;border:1px solid #d8d0c4;background:white;font:12px/1.6 var(--sans)}
.author-studio-field textarea{min-height:150px;resize:vertical}
.author-studio-submit{min-height:45px;border:0;background:#30252c;color:white;cursor:pointer}
.author-studio-message{padding:12px;background:#edf3e9;color:#39513d;font-size:11px}
.author-studio-error{padding:12px;background:#f8ece8;color:#863d32;font-size:11px}
.author-public-link{color:#796747;text-decoration:underline}
`;

export default function AuthorStudioPage() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ authorName: "", biography: "", websiteUrl: "", profilePhotoUrl: "", coverImageUrl: "" });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user?.role !== "author") return;
    getMyAuthorProfile()
      .then(({ author }) => {
        setProfile(author);
        setForm({ authorName: author.authorName, biography: author.biography, websiteUrl: author.websiteUrl || "", profilePhotoUrl: author.profilePhotoUrl || "", coverImageUrl: author.coverImageUrl || "" });
      })
      .catch(() => setError(t.authorProfileError));
  }, [user?.id, user?.role]);

  if (loading) return <main className="author-studio"><p>{t.loadingAccount}</p></main>;
  if (!user) return <Navigate to="/author/login" replace />;
  if (user.role !== "author") return <Navigate to="/author/apply" replace />;

  async function saveProfile(event) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await updateMyAuthorProfile(form);
      setProfile(result.author);
      setNotice(t.authorProfileSaved);
    } catch {
      setError(t.authorProfileError);
    } finally { setBusy(false); }
  }

  return (
    <main className="author-studio">
      <style>{styles}</style>
      <div className="eyebrow"><i />{t.forAuthors}</div>
      <h1>{t.authorStudio}</h1>
      {notice && <p className="author-studio-message" role="status">{notice}</p>}
      {error && <p className="author-studio-error" role="alert">{error}</p>}
      <p><Link className="author-public-link" to="/author/books">{t.manageBooks}</Link></p>
      {profile && <p><Link className="author-public-link" to={`/authors/${profile.slug}`}>{t.openAuthorPage}</Link></p>}
      {profile && <section className="author-studio-stats" aria-label={t.authorStats}>
        <div className="author-studio-stat"><strong>{profile.followerCount ?? 0}</strong><span>{t.authorFollowers}</span></div>
        <div className="author-studio-stat"><strong>{profile.catalogueBookCount ?? 0}</strong><span>{t.authorCatalogueBooks}</span></div>
        <div className="author-studio-stat"><strong>{profile.draftCount ?? 0}</strong><span>{t.authorDraftBooks}</span></div>
        <div className="author-studio-stat"><strong>{profile.submittedCount ?? 0}</strong><span>{t.authorSubmittedBooks}</span></div>
        <div className="author-studio-stat"><strong>{profile.approvedCount ?? 0}</strong><span>{t.authorApprovedBooks}</span></div>
        <div className="author-studio-stat"><strong>{profile.changesRequestedCount ?? 0}</strong><span>{t.authorChangesRequestedBooks}</span></div>
      </section>}
      <section className="author-studio-panel">
        <form className="author-studio-form" onSubmit={saveProfile}>
          <label className="author-studio-field">{t.authorName}<input value={form.authorName} required minLength={2} maxLength={100} onChange={(event) => setForm({ ...form, authorName: event.target.value })} /></label>
          <label className="author-studio-field">{t.authorBiography}<textarea value={form.biography} required minLength={40} maxLength={2000} onChange={(event) => setForm({ ...form, biography: event.target.value })} /></label>
          <label className="author-studio-field">{t.authorWebsite}<input type="url" inputMode="url" placeholder="https://…" value={form.websiteUrl} maxLength={500} onChange={(event) => setForm({ ...form, websiteUrl: event.target.value })} /></label>
          <label className="author-studio-field">{t.authorProfilePhoto}<input type="url" inputMode="url" placeholder="https://…" value={form.profilePhotoUrl} maxLength={500} onChange={(event) => setForm({ ...form, profilePhotoUrl: event.target.value })} /></label>
          <label className="author-studio-field">{t.authorCoverImage}<input type="url" inputMode="url" placeholder="https://…" value={form.coverImageUrl} maxLength={500} onChange={(event) => setForm({ ...form, coverImageUrl: event.target.value })} /></label>
          <button className="author-studio-submit" disabled={busy || !profile}>{busy ? t.savingChanges : t.saveChanges}</button>
        </form>
      </section>
    </main>
  );
}
