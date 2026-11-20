import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { getAdminAuthors, setAdminAuthorStatus } from "../../services/adminAuthorService.js";

const styles = `
.admin-authors{max-width:1080px;min-height:70vh;margin:auto;padding:56px 22px 90px}
.admin-authors h1{font:500 clamp(34px,5vw,48px)/1.1 var(--serif);color:#30252c}
.admin-authors-intro,.admin-author-meta{color:#77716a;font-size:11px;line-height:1.7}
.admin-authors-filters{display:flex;flex-wrap:wrap;align-items:end;gap:12px;margin:24px 0}
.admin-authors-filters label{display:grid;gap:5px;color:#77716a;font-size:11px}
.admin-authors-filters input,.admin-authors-filters select{min-height:40px;min-width:180px;padding:8px 10px;border:1px solid #d8d0c4;background:#fffdfa;color:#30252c}
.admin-authors-filters button,.admin-author-actions button,.admin-authors-pagination button{min-height:40px;padding:0 14px;border:1px solid #30252c;background:transparent;color:#30252c;cursor:pointer}
.admin-authors-filters button:hover,.admin-author-actions button:hover,.admin-authors-pagination button:hover{background:#30252c;color:white}
.admin-authors-filters button:disabled,.admin-author-actions button:disabled,.admin-authors-pagination button:disabled{opacity:.5;cursor:not-allowed}
.admin-author-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;margin:12px 0;padding:20px;border:1px solid #e4ddd1;background:#fffdfa}
.admin-author-card h2{margin:0;color:#30252c;font:500 23px var(--serif)}
.admin-author-card p{margin:8px 0}
.admin-author-bio{color:#77716a;font-size:12px;line-height:1.7;white-space:pre-wrap}
.admin-author-stats{display:flex;flex-wrap:wrap;gap:12px 22px;margin-top:12px;color:#796747;font-size:11px}
.admin-author-actions{display:flex;align-items:start;gap:8px}
.admin-author-actions .suspend{border-color:#863d32;color:#863d32}
.admin-author-actions .restore{border-color:#426c50;color:#426c50}
.admin-authors-error{padding:12px;background:#f8ece8;color:#863d32;font-size:11px}
.admin-authors-success{padding:12px;background:#eef5ed;color:#426c50;font-size:11px}
.admin-authors-empty{padding:24px;border:1px solid #e4ddd1;color:#77716a}
.admin-authors-pagination{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:20px}
@media(max-width:650px){.admin-authors-filters>*{flex:1 1 100%}.admin-authors-filters input,.admin-authors-filters select{width:100%}.admin-author-card{grid-template-columns:1fr}.admin-author-actions{width:100%}}
`;

export default function AdminAuthorsPage() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const [authors, setAuthors] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [filters, setFilters] = useState({ search: "", status: "" });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setError("");
    try {
      const result = await getAdminAuthors({ ...filters, page: String(page) });
      setAuthors(result.authors || []);
      setPagination(result.pagination || { total: 0, totalPages: 0 });
    } catch {
      setError(t.authorManagementError);
    }
  }

  useEffect(() => {
    if (user?.role === "admin") load();
  }, [user?.id, user?.role, filters, page, t.authorManagementError]);

  if (loading) return <main className="admin-authors"><p>{t.loadingAccount}</p></main>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "admin") return <main className="admin-authors"><h1>{t.adminOnly}</h1><Link to="/">{t.backHome}</Link></main>;

  function search(event) {
    event.preventDefault();
    setNotice("");
    setPage(1);
    setFilters({ search: query.trim(), status });
  }

  async function changeStatus(author, nextStatus) {
    const prompt = nextStatus === "suspended" ? t.confirmSuspendAuthor : t.confirmRestoreAuthor;
    if (!window.confirm(prompt)) return;
    setBusyId(author.id);
    setError("");
    setNotice("");
    try {
      await setAdminAuthorStatus(author.id, nextStatus);
      setNotice(nextStatus === "suspended" ? t.authorProfileSuspended : t.authorProfileRestored);
      await load();
    } catch {
      setError(author.accountStatus !== "active" && nextStatus === "active"
        ? t.authorAccountMustBeActive
        : t.authorManagementError);
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="admin-authors">
      <style>{styles}</style>
      <div className="eyebrow"><i />{t.forAuthors}</div>
      <h1>{t.adminAuthorsTitle}</h1>
      <p className="admin-authors-intro">{t.adminAuthorsIntro}</p>
      <form className="admin-authors-filters" onSubmit={search}>
        <label>{t.adminAuthorsSearch}<input value={query} maxLength={80} onChange={(event) => setQuery(event.target.value)} /></label>
        <label>{t.adminUserStatus}<select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">{t.adminUserAllStatuses}</option>
          <option value="active">{t.adminUserActive}</option>
          <option value="suspended">{t.adminUserSuspended}</option>
        </select></label>
        <button type="submit">{t.search}</button>
      </form>
      {error && <p className="admin-authors-error" role="alert">{error}</p>}
      {notice && <p className="admin-authors-success" role="status">{notice}</p>}
      {!authors.length && !error ? <p className="admin-authors-empty">{t.adminAuthorsEmpty}</p> : authors.map((author) => (
        <article className="admin-author-card" key={author.id}>
          <div>
            <h2>{author.authorName}</h2>
            <p className="admin-author-meta">{author.applicant?.displayName} · {author.applicant?.email}</p>
            <p className="admin-author-meta">{t.adminUserStatus}: {author.status === "active" ? t.adminUserActive : t.adminUserSuspended}{author.applicant?.accountStatus !== "active" ? ` · ${t.adminUserStatus}: ${t.adminUserSuspended}` : ""}</p>
            <p className="admin-author-meta">{author.writingLanguages.join(" · ")}{author.genres.length ? ` · ${author.genres.join(" · ")}` : ""}</p>
            <p className="admin-author-bio">{author.biography}</p>
            <div className="admin-author-stats">
              <span>{author.stats.followerCount} {t.authorFollowers}</span>
              <span>{author.stats.catalogueBookCount} {t.authorCatalogueBooks}</span>
              <span>{author.stats.draftCount} {t.authorDraftBooks}</span>
              <span>{author.stats.submittedCount} {t.authorSubmittedBooks}</span>
            </div>
          </div>
          <div className="admin-author-actions">
            {author.status === "active"
              ? <button className="suspend" type="button" disabled={Boolean(busyId)} onClick={() => changeStatus(author, "suspended")}>{busyId === author.id ? t.savingChanges : t.suspendUser}</button>
              : <button className="restore" type="button" disabled={Boolean(busyId) || author.applicant?.accountStatus !== "active"} onClick={() => changeStatus(author, "active")}>{busyId === author.id ? t.savingChanges : t.restoreUser}</button>}
          </div>
        </article>
      ))}
      <div className="admin-authors-pagination">
        <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{t.previousPage}</button>
        <span>{t.adminUserPage} {page} / {Math.max(1, pagination.totalPages)}</span>
        <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>{t.nextPage}</button>
      </div>
    </main>
  );
}
