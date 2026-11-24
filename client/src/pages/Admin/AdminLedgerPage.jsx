import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { getAdminLedgerTransactions } from "../../services/adminLedgerService.js";
import { formatInr } from "../../utils/formatCurrency.js";

const styles = `
.admin-ledger{max-width:1100px;min-height:70vh;margin:auto;padding:54px 22px 90px}
.admin-ledger h1{font:500 clamp(34px,5vw,48px)/1.1 var(--serif);color:#30252c}
.admin-ledger-intro{max-width:760px;color:#77716a;font-size:11px;line-height:1.8}
.admin-ledger-table-wrap{overflow-x:auto;margin:22px 0;border:1px solid #e4ddd1;background:#fffdfa}
.admin-ledger-table{width:100%;border-collapse:collapse;text-align:left;font-size:10px}
.admin-ledger-table th,.admin-ledger-table td{padding:12px;border-bottom:1px solid #e4ddd1;vertical-align:top}
.admin-ledger-table th{color:#796747;font-weight:700}
.admin-ledger-entries{display:grid;gap:6px;min-width:230px}
.admin-ledger-entry{display:flex;justify-content:space-between;gap:14px}
.admin-ledger-entry code{overflow-wrap:anywhere;color:#5f584f}
.admin-ledger-entry strong{white-space:nowrap;font-weight:500}
.admin-ledger-actions{display:flex;align-items:center;gap:12px;margin-top:18px}
.admin-ledger-actions button{min-height:38px;padding:0 12px;border:1px solid #d8d0c4;background:#fffdfa;color:#30252c;cursor:pointer}
.admin-ledger-actions button:disabled{opacity:.5;cursor:not-allowed}
.admin-ledger-error{padding:12px;background:#f8ece8;color:#863d32;font-size:11px}
.admin-ledger-empty{padding:18px;border:1px solid #e4ddd1;background:#fffdfa;color:#77716a;font-size:11px}
@media(max-width:620px){.admin-ledger{padding:38px 16px 64px}.admin-ledger-table th,.admin-ledger-table td{padding:9px}}
`;

function formatTimestamp(value, language) {
  const locale = { en: "en-IN", gu: "gu-IN", hi: "hi-IN" }[language] || "en-IN";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function AdminLedgerPage() {
  const { user, loading } = useAuth();
  const { t, language } = useLanguage();
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(1);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (user?.role !== "admin") return () => { active = false; };
    setLoadingRows(true);
    getAdminLedgerTransactions({ page })
      .then((value) => { if (active) { setResult(value); setError(""); } })
      .catch(() => { if (active) setError(t.adminLedgerError); })
      .finally(() => { if (active) setLoadingRows(false); });
    return () => { active = false; };
  }, [user?.id, user?.role, page, t.adminLedgerError]);

  if (loading) return <main className="admin-ledger"><p>{t.loadingAccount}</p></main>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "admin") return <main className="admin-ledger"><h1>{t.adminOnly}</h1><Link to="/">{t.backHome}</Link></main>;

  const transactions = result?.transactions || [];
  const totalPages = result?.totalPages || 1;
  return (
    <main className="admin-ledger">
      <style>{styles}</style>
      <div className="eyebrow"><i />{t.adminPortal}</div>
      <h1>{t.adminLedgerTitle}</h1>
      <p className="admin-ledger-intro">{t.adminLedgerIntro}</p>
      <p><Link to="/admin">{t.adminDashboardTitle}</Link></p>
      {error && <p className="admin-ledger-error" role="alert">{error}</p>}
      {loadingRows && <p role="status">{t.adminLedgerLoading}</p>}
      {!loadingRows && !error && transactions.length === 0 && <p className="admin-ledger-empty">{t.adminLedgerEmpty}</p>}
      {!error && transactions.length > 0 && <div className="admin-ledger-table-wrap">
        <table className="admin-ledger-table">
          <thead><tr>
            <th scope="col">{t.adminLedgerTime}</th>
            <th scope="col">{t.adminLedgerEvent}</th>
            <th scope="col">{t.adminLedgerOrder}</th>
            <th scope="col">{t.adminLedgerEntries}</th>
          </tr></thead>
          <tbody>{transactions.map((transaction) => <tr key={transaction.id}>
            <td>{formatTimestamp(transaction.occurredAt, language)}</td>
            <td>{t[`ledgerEvent_${transaction.eventType}`] || transaction.eventType}</td>
            <td><code>{transaction.orderId || "—"}</code></td>
            <td><div className="admin-ledger-entries">{transaction.entries.map((entry, index) => <div className="admin-ledger-entry" key={`${entry.accountCode}-${entry.direction}-${index}`}>
              <code>{entry.accountCode} · {t[`ledgerDirection_${entry.direction}`] || entry.direction}</code>
              <strong>{formatInr(entry.amountPaise / 100, language)}</strong>
            </div>)}</div></td>
          </tr>)}</tbody>
        </table>
      </div>}
      {result && totalPages > 1 && <div className="admin-ledger-actions">
        <button type="button" disabled={page <= 1 || loadingRows} onClick={() => setPage((value) => Math.max(1, value - 1))}>{t.previousPage}</button>
        <span>{t.adminUserPage} {page} / {totalPages} · {result.total}</span>
        <button type="button" disabled={page >= totalPages || loadingRows} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>{t.nextPage}</button>
      </div>}
    </main>
  );
}
