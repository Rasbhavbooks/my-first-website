import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { getAdminUsers, setAdminUserStatus } from "../../services/adminUserService.js";

const styles = `
.admin-users{max-width:1080px;min-height:70vh;margin:auto;padding:56px 22px 90px}
.admin-users h1{font:500 clamp(34px,5vw,48px)/1.1 var(--serif);color:#30252c}
.admin-users-intro,.admin-users-meta{color:#77716a;font-size:11px;line-height:1.7}
.admin-users-filters{display:flex;flex-wrap:wrap;align-items:end;gap:12px;margin:24px 0}
.admin-users-filters label{display:grid;gap:5px;color:#77716a;font-size:11px}
.admin-users-filters input,.admin-users-filters select{min-height:40px;min-width:150px;padding:8px 10px;border:1px solid #d8d0c4;background:#fffdfa;color:#30252c}
.admin-users-filters button,.admin-users-actions button,.admin-users-pagination button{min-height:40px;padding:0 14px;border:1px solid #30252c;background:transparent;color:#30252c;cursor:pointer}
.admin-users-filters button:hover,.admin-users-actions button:hover,.admin-users-pagination button:hover{background:#30252c;color:white}
.admin-users-filters button:disabled,.admin-users-actions button:disabled,.admin-users-pagination button:disabled{opacity:.5;cursor:not-allowed}
.admin-users-list{display:grid;gap:10px}
.admin-user-card{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;padding:18px;border:1px solid #e4ddd1;background:#fffdfa}
.admin-user-card h2{margin:0;color:#30252c;font:500 20px var(--serif);overflow-wrap:anywhere}
.admin-user-info{min-width:220px}
.admin-users-actions{display:flex;align-items:center;gap:8px}
.admin-users-actions .suspend{border-color:#863d32;color:#863d32}
.admin-users-actions .restore{border-color:#426c50;color:#426c50}
.admin-users-error{padding:12px;background:#f8ece8;color:#863d32;font-size:11px}
.admin-users-success{padding:12px;background:#eef5ed;color:#426c50;font-size:11px}
.admin-users-empty{padding:24px;border:1px solid #e4ddd1;color:#77716a}
.admin-users-pagination{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:20px}
@media(max-width:560px){.admin-users-filters>*{flex:1 1 100%}.admin-users-filters input,.admin-users-filters select{width:100%}.admin-user-card{align-items:flex-start}.admin-users-actions{width:100%}}
`;

export default function AdminUsersPage() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [filters, setFilters] = useState({ search: "", role: "", status: "" });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setError("");
    try {
      const result = await getAdminUsers({ ...filters, page: String(page) });
      setUsers(result.users || []);
      setPagination(result.pagination || { total: 0, totalPages: 0 });
    } catch {
      setError(t.userManagementError);
    }
  }

  useEffect(() => {
    if (user?.role === "admin") load();
  }, [user?.id, user?.role, filters, page, t.userManagementError]);

  if (loading) return <main className="admin-users"><p>{t.loadingAccount}</p></main>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "admin") return <main className="admin-users"><h1>{t.adminOnly}</h1><Link to="/">{t.backHome}</Link></main>;

  function search(event) {
    event.preventDefault();
    setNotice("");
    setPage(1);
    setFilters({ search: query.trim(), role, status });
  }

  async function changeStatus(target, accountStatus) {
    const prompt = accountStatus === "suspended" ? t.confirmSuspendUser : t.confirmRestoreUser;
    if (!window.confirm(prompt)) return;
    setBusyId(target.id);
    setError("");
    setNotice("");
    try {
      await setAdminUserStatus(target.id, accountStatus);
      setNotice(accountStatus === "suspended" ? t.userSuspended : t.userRestored);
      await load();
    } catch {
      setError(t.userManagementError);
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="admin-users">
      <style>{styles}</style>
      <div className="eyebrow"><i />{t.adminPortal}</div>
      <h1>{t.adminUsersTitle}</h1>
      <p className="admin-users-intro">{t.adminUsersIntro}</p>
      <form className="admin-users-filters" onSubmit={search}>
        <label>{t.adminUserSearch}<input value={query} maxLength={80} onChange={(event) => setQuery(event.target.value)} /></label>
        <label>{t.adminUserRole}<select value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="">{t.adminUserAllRoles}</option>
          <option value="reader">{t.adminUserReader}</option>
          <option value="author">{t.adminUserAuthor}</option>
          <option value="admin">{t.adminUserAdmin}</option>
        </select></label>
        <label>{t.adminUserStatus}<select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">{t.adminUserAllStatuses}</option>
          <option value="pending_verification">{t.adminUserPending}</option>
          <option value="active">{t.adminUserActive}</option>
          <option value="suspended">{t.adminUserSuspended}</option>
        </select></label>
        <button type="submit">{t.search}</button>
      </form>
      {error && <p className="admin-users-error" role="alert">{error}</p>}
      {notice && <p className="admin-users-success" role="status">{notice}</p>}
      {!users.length && !error ? <p className="admin-users-empty">{t.userManagementEmpty}</p> : (
        <div className="admin-users-list">
          {users.map((account) => <article className="admin-user-card" key={account.id}>
            <div className="admin-user-info">
              <h2>{account.displayName}</h2>
              <div className="admin-users-meta">{account.email}</div>
              <div className="admin-users-meta">{t.adminUserRole}: {t[`adminUser${account.role[0].toUpperCase()}${account.role.slice(1)}`]} · {t.adminUserStatus}: {t[`adminUser${account.accountStatus === "pending_verification" ? "Pending" : account.accountStatus === "active" ? "Active" : "Suspended"}`]}</div>
              <div className="admin-users-meta">{t.adminUserCreated}: {new Date(account.createdAt).toLocaleDateString()}</div>
            </div>
            {account.role !== "admin" && account.id !== user.id && account.accountStatus !== "pending_verification" && <div className="admin-users-actions">
              {account.accountStatus === "active"
                ? <button className="suspend" type="button" disabled={Boolean(busyId)} onClick={() => changeStatus(account, "suspended")}>{busyId === account.id ? t.savingChanges : t.suspendUser}</button>
                : <button className="restore" type="button" disabled={Boolean(busyId)} onClick={() => changeStatus(account, "active")}>{busyId === account.id ? t.savingChanges : t.restoreUser}</button>}
            </div>}
          </article>)}
        </div>
      )}
      <div className="admin-users-pagination">
        <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{t.previousPage}</button>
        <span>{t.adminUserPage} {page} / {Math.max(1, pagination.totalPages)}</span>
        <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>{t.nextPage}</button>
      </div>
    </main>
  );
}
