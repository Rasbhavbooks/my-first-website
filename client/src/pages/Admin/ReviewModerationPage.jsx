import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { getReviewReports, resolveReviewReport, updateReviewModeration } from "../../services/adminReviewService.js";

const styles = `
.admin-reviews{max-width:1050px;min-height:70vh;margin:auto;padding:56px 22px 90px}
.admin-reviews h1{font:500 clamp(34px,5vw,48px)/1.1 var(--serif);color:#30252c}
.admin-review-toolbar{display:flex;gap:10px;align-items:center;margin:24px 0}
.admin-review-toolbar select{min-height:40px;padding:0 12px;border:1px solid #d8d0c4;background:#fffdfa}
.admin-review-card{margin:14px 0;padding:22px;border:1px solid #e4ddd1;background:#fffdfa}
.admin-review-card h2{margin:0 0 6px;font:500 23px var(--serif)}
.admin-review-meta,.admin-review-details{color:#77716a;font-size:11px;line-height:1.8}
.admin-review-body{white-space:pre-wrap;line-height:1.7}
.admin-review-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:16px}
.admin-review-actions button{min-height:37px;padding:0 13px;border:1px solid #30252c;background:transparent;color:#30252c;font-size:10px;cursor:pointer}
.admin-review-actions button:hover{background:#30252c;color:white}
.admin-review-actions button:disabled{opacity:.55}
.admin-review-status{font-size:10px;text-transform:uppercase;letter-spacing:.8px}
.admin-review-error{padding:12px;background:#f8ece8;color:#863d32;font-size:11px}
.admin-review-empty{color:#77716a;font-size:12px}
`;

export default function ReviewModerationPage() {
  const { user, loading } = useAuth();
  const { language, t } = useLanguage();
  const [status, setStatus] = useState("pending");
  const [reports, setReports] = useState([]);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function loadReports() {
    setError("");
    try {
      const result = await getReviewReports(status);
      setReports(result.reports || []);
    } catch (requestError) {
      setError(requestError.code === "ADMIN_ACCESS_REQUIRED" ? t.adminOnly : t.reviewActionError);
    }
  }

  useEffect(() => {
    if (user?.role === "admin") loadReports();
  }, [user?.id, user?.role, status]);

  if (loading) return <main className="admin-reviews"><p>{t.loadingAccount}</p></main>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "admin") return <main className="admin-reviews"><h1>{t.adminOnly}</h1><p>{t.backHome}</p><Link to="/">{t.backHome}</Link></main>;

  async function moderate(review) {
    if (!review) return;
    setBusyId(review.id); setError("");
    try {
      const moderationStatus = review.moderationStatus === "hidden" ? "visible" : "hidden";
      await updateReviewModeration(review.id, { moderationStatus });
      await loadReports();
    } catch { setError(t.reviewActionError); }
    finally { setBusyId(""); }
  }

  async function resolve(report, resolution) {
    setBusyId(report.id); setError("");
    try {
      await resolveReviewReport(report.id, { status: resolution });
      await loadReports();
    } catch { setError(t.reviewActionError); }
    finally { setBusyId(""); }
  }

  return (
    <main className="admin-reviews">
      <style>{styles}</style>
      <div className="eyebrow"><i />{t.adminReviewsTitle}</div>
      <h1>{t.reportQueue}</h1>
      <div className="admin-review-toolbar">
        <label>{t.reportReason}{" "}
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="pending">{t.pendingReports}</option>
            <option value="dismissed">{t.dismissedReports}</option>
            <option value="actioned">{t.actionedReports}</option>
          </select>
        </label>
        <button type="button" onClick={loadReports}>{t.viewAll}</button>
      </div>
      {error && <p className="admin-review-error" role="alert">{error}</p>}
      {!reports.length && !error && <p className="admin-review-empty">{t.noReports}</p>}
      {reports.map((report) => (
        <article className="admin-review-card" key={report.id}>
          <div className="admin-review-status">{report.status}</div>
          <h2>{report.review?.book?.title?.[language] || report.review?.catalogueId || t.bookDetails}</h2>
          <p className="admin-review-meta">{t.by} {report.review?.book?.author || "—"} · {t.reviewReportedBy}: {report.reporter?.displayName || "—"} · {report.reason}</p>
          {report.details && <p className="admin-review-details">{report.details}</p>}
          {report.review ? (
            <>
              <p className="admin-review-meta">{report.review.rating}/5 · {report.review.reader?.displayName || "Reader"} · {report.review.moderationStatus}</p>
              <p className="admin-review-body">{report.review.body}</p>
              <div className="admin-review-actions">
                <button type="button" disabled={Boolean(busyId)} onClick={() => moderate(report.review)}>
                  {report.review.moderationStatus === "hidden" ? t.showReview : t.hideReview}
                </button>
                {report.status === "pending" && <>
                  <button type="button" disabled={Boolean(busyId)} onClick={() => resolve(report, "dismissed")}>{t.dismissReport}</button>
                  <button type="button" disabled={Boolean(busyId)} onClick={() => resolve(report, "actioned")}>{t.actionReport}</button>
                </>}
              </div>
            </>
          ) : <p className="admin-review-details">{t.reviewNotAvailable}</p>}
        </article>
      ))}
    </main>
  );
}
