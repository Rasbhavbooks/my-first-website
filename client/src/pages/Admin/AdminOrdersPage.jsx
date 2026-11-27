import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { getAdminOrders } from "../../services/adminOrdersService.js";
import { formatInr } from "../../utils/formatCurrency.js";

const styles = `
.admin-orders{max-width:1160px;min-height:70vh;margin:auto;padding:54px 22px 90px}
.admin-orders h1{font:500 clamp(34px,5vw,48px)/1.1 var(--serif);color:#30252c}
.admin-orders-intro{max-width:780px;color:#77716a;font-size:11px;line-height:1.8}
.admin-orders-filter{display:flex;align-items:center;gap:10px;margin:20px 0;color:#5f584f;font-size:11px}
.admin-orders-filter select{min-height:40px;padding:0 10px;border:1px solid #d8d0c4;background:#fffdfa;color:#30252c;font:inherit}
.admin-orders-wrap{overflow-x:auto;margin:22px 0;border:1px solid #e4ddd1;background:#fffdfa}
.admin-orders-table{width:100%;border-collapse:collapse;text-align:left;font-size:10px}
.admin-orders-table th,.admin-orders-table td{padding:12px;border-bottom:1px solid #e4ddd1;vertical-align:top}
.admin-orders-table th{color:#796747;font-weight:700}
.admin-orders-table code{overflow-wrap:anywhere}
.admin-orders-book{min-width:170px;display:grid;gap:4px}
.admin-orders-book small{color:#77716a}
.admin-orders-status{font-weight:700}
.admin-orders-status[data-status="paid"]{color:#28724f}
.admin-orders-status[data-status="pending_payment"],.admin-orders-status[data-status="refund_pending"]{color:#9b4c35}
.admin-orders-status[data-status="cancelled"],.admin-orders-status[data-status="refunded"]{color:#796747}
.admin-orders-error{padding:12px;background:#f8ece8;color:#863d32;font-size:11px}
.admin-orders-empty{padding:18px;border:1px solid #e4ddd1;background:#fffdfa;color:#77716a;font-size:11px}
.admin-orders-actions{display:flex;align-items:center;gap:12px;margin-top:18px}
.admin-orders-actions button{min-height:38px;padding:0 12px;border:1px solid #d8d0c4;background:#fffdfa;color:#30252c;cursor:pointer}
.admin-orders-actions button:disabled{opacity:.5;cursor:not-allowed}
@media(max-width:620px){.admin-orders{padding:38px 16px 64px}.admin-orders-table th,.admin-orders-table td{padding:9px}}
`;

function formatTimestamp(value, language) {
  if (!value) return "—";
  const locale = { en: "en-IN", gu: "gu-IN", hi: "hi-IN" }[language] || "en-IN";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function AdminOrdersPage() {
  const { user, loading } = useAuth();
  const { t, language } = useLanguage();
  const refundRecordLabels = {
    gu: { refund_linked: "રિફંડનો હિસાબ મળે છે", missing_refund: "રિફંડની નોંધ ખૂટે છે" },
    hi: { refund_linked: "रिफंड का हिसाब मेल खाता है", missing_refund: "रिफंड की प्रविष्टि नहीं मिली" },
    en: { refund_linked: "Refund matches", missing_refund: "Missing refund entry" },
  }[language];
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (user?.role !== "admin") return () => { active = false; };
    setLoadingRows(true);
    getAdminOrders({ page, status })
      .then((value) => { if (active) { setResult(value); setError(""); } })
      .catch(() => { if (active) setError(t.adminOrdersError); })
      .finally(() => { if (active) setLoadingRows(false); });
    return () => { active = false; };
  }, [user?.id, user?.role, page, status, t.adminOrdersError]);

  if (loading) return <main className="admin-orders"><p>{t.loadingAccount}</p></main>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "admin") return <main className="admin-orders"><h1>{t.adminOnly}</h1><Link to="/">{t.backHome}</Link></main>;

  const orders = result?.orders || [];
  const totalPages = result?.totalPages || 1;
  return (
    <main className="admin-orders">
      <style>{styles}</style>
      <div className="eyebrow"><i />{t.adminPortal}</div>
      <h1>{t.adminOrdersTitle}</h1>
      <p className="admin-orders-intro">{t.adminOrdersIntro}</p>
      <p>{t.adminOrdersPrivacyNote}</p>
      <p><Link to="/admin">{t.adminDashboardTitle}</Link> · <Link to="/admin/payment-reconciliation">{t.adminPaymentReconciliationTitle}</Link> · <Link to="/admin/ledger">{t.adminLedgerTitle}</Link></p>
      <label className="admin-orders-filter">
        <span>{t.adminOrderStatusFilter}</span>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="all">{t.adminOrderStatus_all}</option>
          <option value="pending_payment">{t.adminOrderStatus_pending_payment}</option>
          <option value="paid">{t.adminOrderStatus_paid}</option>
          <option value="cancelled">{t.adminOrderStatus_cancelled}</option>
          <option value="refund_pending">{t.adminOrderStatus_refund_pending}</option>
          <option value="refunded">{t.adminOrderStatus_refunded}</option>
        </select>
      </label>
      {error && <p className="admin-orders-error" role="alert">{error}</p>}
      {loadingRows && <p role="status">{t.adminOrdersLoading}</p>}
      {!loadingRows && !error && orders.length === 0 && <p className="admin-orders-empty">{t.adminOrdersEmpty}</p>}
      {!error && orders.length > 0 && <div className="admin-orders-wrap">
        <table className="admin-orders-table">
          <thead><tr>
            <th scope="col">{t.adminOrderBook}</th><th scope="col">{t.adminOrderCreated}</th>
            <th scope="col">{t.adminOrderAmount}</th><th scope="col">{t.adminOrderStatus}</th>
            <th scope="col">{t.adminOrderPaidAt}</th><th scope="col">{t.adminOrderRecordStatus}</th><th scope="col">{t.adminOrderId}</th>
          </tr></thead>
          <tbody>{orders.map((order) => <tr key={order.id}>
            <td><div className="admin-orders-book"><strong>{order.bookTitle?.[language] || order.bookTitle?.en || order.bookId}</strong><small>{order.authorName}</small></div></td>
            <td>{formatTimestamp(order.createdAt, language)}</td>
            <td>{formatInr(order.amountPaise / 100, language)}
              {order.allocation && <details>
                <summary>{t.priceBreakdownTitle}</summary>
                <dl>{[
                  [t.priceAuthorShare, order.allocation.author],
                  ["Rasbhav Books", order.allocation.platform],
                  [{ gu: "રેફરલ હિસ્સો", hi: "रेफरल हिस्सा", en: "Referral share" }[language], order.allocation.referral],
                  [t.priceGst, order.allocation.gst],
                  [t.priceGateway, order.allocation.gateway],
                ].map(([label, amount]) => <div key={label}><dt>{label}</dt><dd>{formatInr(amount / 100, language)}</dd></div>)}</dl>
              </details>}
            </td>
            <td><span className="admin-orders-status" data-status={order.status}>{t[`adminOrderStatus_${order.status}`] || order.status}</span></td>
            <td>{formatTimestamp(order.paidAt, language)}</td>
            <td>{order.recordStatus ? refundRecordLabels?.[order.recordStatus] || t[`adminOrderRecord_${order.recordStatus}`] : "—"}</td>
            <td><code>{order.id}</code></td>
          </tr>)}</tbody>
        </table>
      </div>}
      {result && totalPages > 1 && <div className="admin-orders-actions">
        <button type="button" disabled={page <= 1 || loadingRows} onClick={() => setPage((value) => Math.max(1, value - 1))}>{t.previousPage}</button>
        <span>{t.adminUserPage} {page} / {totalPages} · {result.total}</span>
        <button type="button" disabled={page >= totalPages || loadingRows} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>{t.nextPage}</button>
      </div>}
    </main>
  );
}
