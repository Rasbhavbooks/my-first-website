import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { decideAuthorApplication, getAuthorApplications } from "../../services/authorService.js";

const styles = `
.author-admin{max-width:1080px;min-height:70vh;margin:auto;padding:56px 22px 90px}
.author-admin h1{font:500 clamp(34px,5vw,48px)/1.1 var(--serif);color:#30252c}
.author-admin-toolbar{display:flex;align-items:center;gap:12px;margin:24px 0}
.author-admin-toolbar select,.author-admin-note{min-height:40px;padding:9px 12px;border:1px solid #d8d0c4;background:#fffdfa}
.author-app-card{margin:14px 0;padding:22px;border:1px solid #e4ddd1;background:#fffdfa}
.author-app-card h2{margin:0;font:500 24px var(--serif)}
.author-app-meta,.author-app-bio{color:#77716a;font-size:11px;line-height:1.8;white-space:pre-wrap}
.author-app-note{width:100%;margin-top:10px}
.author-admin-actions{display:flex;gap:10px;margin-top:14px}
.author-admin-actions button{min-height:38px;padding:0 14px;border:1px solid #30252c;background:transparent;color:#30252c;cursor:pointer}
.author-admin-actions button:hover{background:#30252c;color:white}
.author-admin-actions button:disabled{opacity:.6}
.author-admin-error{padding:12px;background:#f8ece8;color:#863d32;font-size:11px}
.author-admin-empty{color:#77716a;font-size:12px}
`;

export default function AuthorApplicationsPage() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const [status, setStatus] = useState("pending");
  const [applications, setApplications] = useState([]);
  const [notes, setNotes] = useState({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const result = await getAuthorApplications(status);
      setApplications(result.applications || []);
    } catch {
      setError(t.authorApplicationError);
    }
  }

  useEffect(() => {
    if (user?.role === "admin") load();
  }, [user?.id, user?.role, status]);

  if (loading) return <main className="author-admin"><p>{t.loadingAccount}</p></main>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "admin") return <main className="author-admin"><h1>{t.adminOnly}</h1><Link to="/">{t.backHome}</Link></main>;

  async function review(application, decision) {
    setBusyId(application.id);
    setError("");
    try {
      await decideAuthorApplication(application.id, { decision, adminNote: notes[application.id] || "" });
      await load();
    } catch {
      setError(t.authorApplicationError);
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="author-admin">
      <style>{styles}</style>
      <div className="eyebrow"><i />{t.forAuthors}</div>
      <h1>{t.authorApplicationsTitle}</h1>
      <div className="author-admin-toolbar">
        <label>{t.applicationStatus}{" "}
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="pending">{t.applicationPendingShort}</option>
            <option value="approved">{t.applicationApprovedShort}</option>
            <option value="rejected">{t.applicationRejectedShort}</option>
          </select>
        </label>
        <button type="button" onClick={load}>{t.viewAll}</button>
      </div>
      {error && <p className="author-admin-error" role="alert">{error}</p>}
      {!applications.length && !error && <p className="author-admin-empty">{t.noAuthorApplications}</p>}
      {applications.map((application) => (
        <article className="author-app-card" key={application.id}>
          <h2>{application.authorName}</h2>
          <p className="author-app-meta">{application.applicant?.displayName} · {application.applicant?.email} · {application.status}</p>
          <p className="author-app-bio">{application.biography}</p>
          <p className="author-app-meta">{t.writingLanguages}: {application.writingLanguages.join(", ")} · {t.authorGenres}: {application.genres.join(", ") || "—"}</p>
          {application.writingSampleUrl && <p><a href={application.writingSampleUrl} target="_blank" rel="noreferrer">{t.writingSampleUrl}</a></p>}
          {application.adminNote && <p className="author-app-meta">{t.adminNote}: {application.adminNote}</p>}
          {application.status === "pending" && <>
            <label className="author-app-meta">{t.adminNote}<input className="author-admin-note" value={notes[application.id] || ""} maxLength={800} onChange={(event) => setNotes((current) => ({ ...current, [application.id]: event.target.value }))} /></label>
            <div className="author-admin-actions">
              <button type="button" disabled={Boolean(busyId)} onClick={() => review(application, "approved")}>{busyId === application.id ? t.savingChanges : t.approveApplication}</button>
              <button type="button" disabled={Boolean(busyId)} onClick={() => review(application, "rejected")}>{t.rejectApplication}</button>
            </div>
          </>}
        </article>
      ))}
    </main>
  );
}
