import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { getAdminPaymentReconciliation } from "../../services/adminPaymentReconciliationService.js";
import { formatInr } from "../../utils/formatCurrency.js";

const copy = {
  en: {
    title: "Payment reconciliation",
    intro: "Compare verified payment events with the financial ledger. This page is read-only and never posts or changes a payment.",
    note: "Unposted means an applied event has no matching ledger entry yet. Review it through the approved payment workflow; this page cannot repair or post records.",
    empty: "No payment events have been recorded.",
    loading: "Loading payment events…",
    error: "Payment reconciliation could not be loaded.",
    time: "Received", verified: "Verified", event: "Event", order: "Order", amount: "Amount", status: "Ledger status",
    posted: "Posted", unposted: "Needs review", ignored: "Ignored",
  },
  gu: {
    title: "ચુકવણી મેળવણી",
    intro: "ચકાસેલી ચુકવણી ઘટનાઓ અને નાણાકીય ledger સરખાવો. આ પાનું ફક્ત જોવા માટે છે; તે ચુકવણીમાં ફેરફાર કે પોસ્ટિંગ કરતું નથી.",
    note: "“સમીક્ષા જરૂરી”નો અર્થ: મંજૂર થયેલી event માટે ledger નોંધ મળી નથી. મંજૂર પ્રક્રિયા દ્વારા તપાસો; આ પાનું રેકોર્ડ સુધારતું કે પોસ્ટ કરતું નથી.",
    empty: "હજુ કોઈ payment event નોંધાઈ નથી.",
    loading: "ચુકવણી events લોડ થઈ રહી છે…",
    error: "ચુકવણી મેળવણી ખૂલી શકી નથી.",
    time: "મળ્યાનો સમય", verified: "ચકાસણી સમય", event: "Event", order: "ઓર્ડર", amount: "રકમ", status: "Ledger સ્થિતિ",
    posted: "પોસ્ટ થયું", unposted: "સમીક્ષા જરૂરી", ignored: "અવગણ્યું",
  },
  hi: {
    title: "भुगतान मिलान",
    intro: "सत्यापित भुगतान घटनाओं की वित्तीय ledger से तुलना करें। यह पेज केवल पढ़ने के लिए है; यह भुगतान पोस्ट या बदलता नहीं है।",
    note: "“समीक्षा आवश्यक” का अर्थ है कि लागू event के लिए ledger प्रविष्टि नहीं मिली। स्वीकृत प्रक्रिया से जाँचें; यह पेज रिकॉर्ड ठीक या पोस्ट नहीं करता।",
    empty: "अभी कोई payment event दर्ज नहीं है।",
    loading: "भुगतान events लोड हो रही हैं…",
    error: "भुगतान मिलान लोड नहीं हो सका।",
    time: "प्राप्त समय", verified: "सत्यापन समय", event: "Event", order: "ऑर्डर", amount: "राशि", status: "Ledger स्थिति",
    posted: "पोस्ट हुआ", unposted: "समीक्षा आवश्यक", ignored: "अनदेखा",
  },
};

const styles = `
.admin-recon{max-width:1100px;min-height:70vh;margin:auto;padding:54px 22px 90px}
.admin-recon h1{font:500 clamp(34px,5vw,48px)/1.1 var(--serif);color:#30252c}
.admin-recon-intro{max-width:760px;color:#77716a;font-size:11px;line-height:1.8}
.admin-recon-note{padding:13px 15px;border:1px solid #e4ddd1;background:#fffdfa;color:#5f584f;font-size:11px;line-height:1.7}
.admin-recon-wrap{overflow-x:auto;margin:22px 0;border:1px solid #e4ddd1;background:#fffdfa}
.admin-recon-table{width:100%;border-collapse:collapse;text-align:left;font-size:10px}
.admin-recon-table th,.admin-recon-table td{padding:12px;border-bottom:1px solid #e4ddd1;vertical-align:top}
.admin-recon-table th{color:#796747;font-weight:700}
.admin-recon-table code{overflow-wrap:anywhere}
.admin-recon-status{font-weight:700}
.admin-recon-status[data-status="posted"]{color:#28724f}
.admin-recon-status[data-status="unposted"]{color:#9b4c35}
.admin-recon-status[data-status="ignored"]{color:#796747}
.admin-recon-error{padding:12px;background:#f8ece8;color:#863d32;font-size:11px}
.admin-recon-empty{padding:18px;border:1px solid #e4ddd1;background:#fffdfa;color:#77716a;font-size:11px}
.admin-recon-actions{display:flex;align-items:center;gap:12px;margin-top:18px}
.admin-recon-actions button{min-height:38px;padding:0 12px;border:1px solid #d8d0c4;background:#fffdfa;color:#30252c;cursor:pointer}
.admin-recon-actions button:disabled{opacity:.5;cursor:not-allowed}
@media(max-width:620px){.admin-recon{padding:38px 16px 64px}.admin-recon-table th,.admin-recon-table td{padding:9px}}
`;

function formatTimestamp(value, language) {
  if (!value) return "—";
  const locale = { en: "en-IN", gu: "gu-IN", hi: "hi-IN" }[language] || "en-IN";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function AdminPaymentReconciliationPage() {
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const text = copy[language] || copy.en;
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(1);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (user?.role !== "admin") return () => { active = false; };
    setLoadingRows(true);
    getAdminPaymentReconciliation({ page })
      .then((value) => { if (active) { setResult(value); setError(""); } })
      .catch(() => { if (active) setError(text.error); })
      .finally(() => { if (active) setLoadingRows(false); });
    return () => { active = false; };
  }, [user?.id, user?.role, page, text.error]);

  if (loading) return <main className="admin-recon"><p>{text.loading}</p></main>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "admin") return <main className="admin-recon"><h1>{text.title}</h1><Link to="/">{copy.en.title}</Link></main>;

  const events = result?.events || [];
  const totalPages = result?.totalPages || 1;
  return (
    <main className="admin-recon">
      <style>{styles}</style>
      <div className="eyebrow"><i />Admin</div>
      <h1>{text.title}</h1>
      <p className="admin-recon-intro">{text.intro}</p>
      <p className="admin-recon-note">{text.note}</p>
      <p><Link to="/admin">Admin dashboard</Link> · <Link to="/admin/ledger">Financial ledger</Link></p>
      {error && <p className="admin-recon-error" role="alert">{error}</p>}
      {loadingRows && <p role="status">{text.loading}</p>}
      {!loadingRows && !error && events.length === 0 && <p className="admin-recon-empty">{text.empty}</p>}
      {!error && events.length > 0 && <div className="admin-recon-wrap">
        <table className="admin-recon-table">
          <thead><tr>
            <th scope="col">{text.time}</th><th scope="col">{text.verified}</th><th scope="col">{text.event}</th>
            <th scope="col">{text.order}</th><th scope="col">{text.amount}</th><th scope="col">{text.status}</th>
          </tr></thead>
          <tbody>{events.map((event) => <tr key={event.id}>
            <td>{formatTimestamp(event.occurredAt, language)}</td><td>{formatTimestamp(event.verifiedAt, language)}</td>
            <td>{event.eventType}</td><td><code>{event.orderId || "—"}</code></td>
            <td>{formatInr(event.amountPaise / 100, language)}</td>
            <td><span className="admin-recon-status" data-status={event.status}>{text[event.status] || event.status}</span></td>
          </tr>)}</tbody>
        </table>
      </div>}
      {result && totalPages > 1 && <div className="admin-recon-actions">
        <button type="button" disabled={page <= 1 || loadingRows} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
        <span>{page} / {totalPages} · {result.total}</span>
        <button type="button" disabled={page >= totalPages || loadingRows} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
      </div>}
    </main>
  );
}
