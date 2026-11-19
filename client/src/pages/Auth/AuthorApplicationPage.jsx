import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { getMyAuthorApplication, submitAuthorApplication } from "../../services/authorService.js";

const languages = ["Gujarati", "Hindi", "English"];
const styles = `
.author-apply{max-width:850px;min-height:70vh;margin:auto;padding:60px 22px 90px}
.author-apply h1{font:500 clamp(34px,5vw,48px)/1.1 var(--serif);color:#30252c}
.author-apply-intro{max-width:650px;color:#77716a;font-size:12px;line-height:1.8}
.author-apply-panel{margin-top:25px;padding:28px;border:1px solid #e4ddd1;background:#fffdfa}
.author-apply-form{display:grid;gap:17px}
.author-apply-field{display:grid;gap:7px;color:#514a44;font-size:11px;font-weight:600}
.author-apply-field input,.author-apply-field textarea{width:100%;padding:12px;border:1px solid #d8d0c4;background:white;color:#30252c;font:12px/1.6 var(--sans)}
.author-apply-field textarea{min-height:150px;resize:vertical}
.author-language-list{display:flex;flex-wrap:wrap;gap:16px}
.author-language-list label{display:flex;align-items:center;gap:7px;font-size:11px}
.author-apply-submit{min-height:46px;padding:0 18px;border:0;background:#30252c;color:#fff;cursor:pointer}
.author-apply-submit:disabled{opacity:.6;cursor:wait}
.author-app-message{padding:13px;background:#edf3e9;color:#39513d;font-size:12px;line-height:1.7}
.author-app-error{padding:13px;background:#f8ece8;color:#863d32;font-size:12px}
.author-app-link{color:#796747;text-decoration:underline}
`;

export default function AuthorApplicationPage() {
  const { t } = useLanguage();
  const { user, loading } = useAuth();
  const [application, setApplication] = useState(null);
  const [form, setForm] = useState({ authorName: "", biography: "", writingLanguages: [], genres: "", writingSampleUrl: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "reader") return;
    getMyAuthorApplication()
      .then(({ application: saved }) => {
        setApplication(saved);
        if (saved?.status === "rejected") {
          setForm({
            authorName: saved.authorName,
            biography: saved.biography,
            writingLanguages: saved.writingLanguages,
            genres: saved.genres.join(", "),
            writingSampleUrl: saved.writingSampleUrl || "",
          });
        } else {
          setForm((current) => ({ ...current, authorName: user.displayName || "" }));
        }
      })
      .catch(() => setError(t.applicationLoadError))
      .finally(() => setLoaded(true));
  }, [user?.id, user?.role]);

  if (loading) return <main className="author-apply"><p>{t.loadingAccount}</p></main>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "author") return <Navigate to="/author/studio" replace />;
  if (user.role !== "reader") return <main className="author-apply"><h1>{t.authorApplyTitle}</h1><p>{t.adminOnly}</p></main>;

  function toggleLanguage(language) {
    setForm((current) => ({
      ...current,
      writingLanguages: current.writingLanguages.includes(language)
        ? current.writingLanguages.filter((item) => item !== language)
        : [...current.writingLanguages, language],
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await submitAuthorApplication({
        authorName: form.authorName,
        biography: form.biography,
        writingLanguages: form.writingLanguages,
        genres: form.genres.split(",").map((item) => item.trim()).filter(Boolean),
        writingSampleUrl: form.writingSampleUrl,
      });
      setApplication(result.application);
    } catch (requestError) {
      setError(requestError.code === "INVALID_AUTHOR_APPLICATION" ? t.applicationInvalid : t.authorApplicationError);
    } finally {
      setBusy(false);
    }
  }

  if (!loaded && !application) return <main className="author-apply"><p>{t.loadingAccount}</p></main>;

  return (
    <main className="author-apply">
      <style>{styles}</style>
      <div className="eyebrow"><i />{t.forAuthors}</div>
      <h1>{t.authorApplyTitle}</h1>
      <p className="author-apply-intro">{t.authorApplyIntro}</p>
      {error && <p className="author-app-error" role="alert">{error}</p>}
      {application?.status === "pending" && <section className="author-apply-panel"><p className="author-app-message">{t.applicationPending}</p></section>}
      {application?.status === "approved" && <section className="author-apply-panel"><p className="author-app-message">{t.applicationApproved}</p><Link className="author-app-link" to="/author/studio">{t.authorStudio}</Link></section>}
      {application?.status === "rejected" && <section className="author-apply-panel"><p className="author-app-error">{t.applicationRejected}{application.adminNote ? ` — ${application.adminNote}` : ""}</p></section>}
      {(!application || application.status === "rejected") && (
        <section className="author-apply-panel">
          <form className="author-apply-form" onSubmit={handleSubmit}>
            <label className="author-apply-field">{t.authorName}<input required minLength={2} maxLength={100} value={form.authorName} onChange={(event) => setForm({ ...form, authorName: event.target.value })} /></label>
            <label className="author-apply-field">{t.authorBiography}<textarea required minLength={40} maxLength={2000} value={form.biography} onChange={(event) => setForm({ ...form, biography: event.target.value })} /></label>
            <fieldset className="author-apply-field"><legend>{t.writingLanguages}</legend><div className="author-language-list">{languages.map((language) => <label key={language}><input type="checkbox" checked={form.writingLanguages.includes(language)} onChange={() => toggleLanguage(language)} />{language}</label>)}</div></fieldset>
            <label className="author-apply-field">{t.authorGenres}<input value={form.genres} maxLength={420} placeholder={t.authorGenresHint} onChange={(event) => setForm({ ...form, genres: event.target.value })} /></label>
            <label className="author-apply-field">{t.writingSampleUrl}<input type="url" inputMode="url" placeholder="https://…" value={form.writingSampleUrl} onChange={(event) => setForm({ ...form, writingSampleUrl: event.target.value })} /></label>
            <button className="author-apply-submit" disabled={busy}>{busy ? t.savingChanges : t.submitApplication}</button>
          </form>
        </section>
      )}
    </main>
  );
}
