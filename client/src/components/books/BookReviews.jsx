import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import {
  createBookReview,
  deleteBookReview,
  getBookReviews,
  getMyBookReview,
  reportBookReview,
  updateBookReview,
} from "../../services/reviewService.js";

const styles = `
.book-reviews{margin-top:62px;padding-top:32px;border-top:1px solid var(--line)}
.reviews-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:24px}
.reviews-heading h2{margin:0;font:500 clamp(28px,4vw,38px)/1.15 var(--serif)}
.reviews-summary{color:#796747;font-size:12px}
.review-form{max-width:760px;padding:22px;margin:0 0 30px;border:1px solid var(--line);background:#fffdfa}
.review-form h3{margin:0 0 16px;font:500 22px var(--serif)}
.review-form label{display:grid;gap:7px;margin-bottom:13px;color:#5f584f;font-size:10px}
.review-form select,.review-form textarea{width:100%;padding:10px 12px;border:1px solid #d7cec0;background:#fff;color:var(--ink);font:12px/1.6 var(--sans)}
.review-form textarea{min-height:105px;resize:vertical}
.review-form select:focus,.review-form textarea:focus{outline:2px solid #d6ae68;outline-offset:1px}
.review-hint{margin:-5px 0 12px;color:#82796e;font-size:9px;line-height:1.6}
.review-submit{min-height:42px;padding:0 18px;border:0;background:#30252c;color:white;font-size:10px;cursor:pointer}
.review-submit:disabled{opacity:.6;cursor:wait}
.review-notice{margin:0 0 16px;padding:10px 12px;font-size:10px;background:#edf3e9;color:#39513d}
.review-error{margin:0 0 16px;padding:10px 12px;font-size:10px;background:#f8ece8;color:#863d32}
.review-login{padding:18px;border:1px solid var(--line);color:#716b63;font-size:11px}
.review-list{max-width:820px;display:grid;gap:14px}
.review-card{padding:19px 20px;border:1px solid var(--line);background:#fffdfa}
.review-card-head{display:flex;align-items:center;justify-content:space-between;gap:14px}
.review-reader{display:flex;align-items:center;gap:11px}
.review-avatar{width:38px;height:38px;border-radius:50%;object-fit:cover;background:#eee8de}
.review-reader-name{font-size:11px;font-weight:600}.review-date{margin-top:4px;color:#81796f;font-size:9px}
.review-stars{color:#9a7136;letter-spacing:2px;font-size:13px;white-space:nowrap}
.review-body{margin:14px 0 0;color:#615b54;font-size:12px;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere}
.review-actions{display:flex;gap:12px;margin-top:12px}
.review-text-button{padding:0;border:0;background:transparent;color:#796747;font-size:9px;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.review-report-form{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.review-report-form select,.review-report-form input{min-height:34px;padding:6px 9px;border:1px solid #d7cec0;background:#fff;font-size:10px}
.review-empty{padding:22px;border:1px dashed #d7cec0;color:#81796f;font-size:11px}
@media(max-width:620px){.reviews-heading{align-items:flex-start;flex-direction:column}.review-form{padding:17px}.review-card{padding:16px}.review-stars{font-size:11px}}
`;

export default function BookReviews({ bookId }) {
  const { t, language } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState({ reviews: [], total: 0, averageRating: 0, ratingCount: 0 });
  const [myReview, setMyReview] = useState(null);
  const [rating, setRating] = useState("5");
  const [body, setBody] = useState("");
  const [reportId, setReportId] = useState("");
  const [reportReason, setReportReason] = useState("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function loadReviews() {
    const result = await getBookReviews(bookId);
    setData(result);
  }

  useEffect(() => {
    let active = true;
    getBookReviews(bookId)
      .then((result) => { if (active) setData(result); })
      .catch(() => { if (active) setError(t.reviewsLoadError); });
    return () => { active = false; };
  }, [bookId, t.reviewsLoadError]);

  useEffect(() => {
    let active = true;
    if (authLoading || !user) {
      setMyReview(null);
      setBody("");
      return () => { active = false; };
    }
    getMyBookReview(bookId)
      .then((result) => {
        if (!active) return;
        const ownReview = result.review;
        setMyReview(ownReview);
        if (ownReview) {
          setRating(String(ownReview.rating));
          setBody(ownReview.body);
        } else {
          setRating("5");
          setBody("");
        }
      })
      .catch(() => { if (active) setError(t.reviewsLoadError); });
    return () => { active = false; };
  }, [bookId, user?.id, authLoading, t.reviewsLoadError]);

  async function handleSubmit(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    setBusy(true);
    try {
      const payload = { rating: Number(rating), body };
      const result = myReview
        ? await updateBookReview(bookId, myReview.id, payload)
        : await createBookReview(bookId, payload);
      setMyReview(result.review);
      setNotice(t.reviewSaved);
      await loadReviews();
    } catch (requestError) {
      setError(requestError.code === "REVIEW_EXISTS" ? t.reviewAlreadyExists
        : requestError.code === "INVALID_REVIEW" ? t.reviewInvalid
        : t.reviewActionError);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!myReview) return;
    setNotice("");
    setError("");
    setBusy(true);
    try {
      await deleteBookReview(bookId, myReview.id);
      setMyReview(null);
      setRating("5");
      setBody("");
      setNotice(t.reviewDeleted);
      await loadReviews();
    } catch {
      setError(t.reviewActionError);
    } finally {
      setBusy(false);
    }
  }

  async function handleReport(review) {
    setNotice("");
    setError("");
    setBusy(true);
    try {
      await reportBookReview(bookId, review.id, { reason: reportReason, details: reportDetails });
      setReportId("");
      setReportDetails("");
      setNotice(t.reviewReported);
    } catch (requestError) {
      setError(requestError.code === "REVIEW_ALREADY_REPORTED" ? t.reviewAlreadyReported : t.reviewActionError);
    } finally {
      setBusy(false);
    }
  }

  const locale = language === "gu" ? "gu-IN" : language === "hi" ? "hi-IN" : "en-IN";

  return (
    <section className="book-reviews" aria-labelledby="reviews-title">
      <style>{styles}</style>
      <div className="reviews-heading">
        <h2 id="reviews-title">{t.reviewsTitle}</h2>
        <div className="reviews-summary" aria-label={`${data.averageRating} ${t.averageRating}, ${data.ratingCount} ${t.reviewCount}`}>
          {data.ratingCount ? <><strong>{data.averageRating.toFixed(1)}</strong> ★ · {data.ratingCount} {t.reviewCount}</> : t.noRatings}
        </div>
      </div>

      {notice && <p className="review-notice" role="status">{notice}</p>}
      {error && <p className="review-error" role="alert">{error}</p>}

      {authLoading ? null : user ? (
        <form className="review-form" onSubmit={handleSubmit}>
          <h3>{myReview ? t.editYourReview : t.writeReview}</h3>
          <label>
            {t.ratingLabel}
            <select value={rating} onChange={(event) => setRating(event.target.value)}>
              {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} ★</option>)}
            </select>
          </label>
          <label>
            {t.reviewText}
            <textarea value={body} onChange={(event) => setBody(event.target.value)} minLength={10} maxLength={2000} required />
          </label>
          <p className="review-hint">{t.reviewHint}</p>
          <button className="review-submit" disabled={busy}>{busy ? t.savingChanges : myReview ? t.updateReview : t.submitReview}</button>
          {myReview && <button className="review-text-button" type="button" disabled={busy} onClick={handleDelete}>{t.deleteReview}</button>}
        </form>
      ) : (
        <p className="review-login">{t.reviewLoginPrompt} <Link to="/login">{t.signIn}</Link></p>
      )}

      {data.reviews.length ? (
        <div className="review-list">
          {data.reviews.map((review) => (
            <article className="review-card" key={review.id}>
              <div className="review-card-head">
                <div className="review-reader">
                  {review.reader.avatarUrl
                    ? <img className="review-avatar" src={review.reader.avatarUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
                    : <span className="review-avatar" aria-hidden="true" />}
                  <div><div className="review-reader-name">{review.reader.displayName}</div><div className="review-date">{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(review.createdAt))}</div></div>
                </div>
                <span className="review-stars" aria-label={`${review.rating} ${t.outOfFive}`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
              </div>
              <p className="review-body">{review.body}</p>
              {user && myReview?.id !== review.id && (
                <div className="review-actions">
                  <button className="review-text-button" type="button" onClick={() => setReportId(reportId === review.id ? "" : review.id)}>{t.reportReview}</button>
                </div>
              )}
              {reportId === review.id && (
                <form className="review-report-form" onSubmit={(event) => { event.preventDefault(); handleReport(review); }}>
                  <select value={reportReason} onChange={(event) => setReportReason(event.target.value)} aria-label={t.reportReason}>
                    <option value="spam">{t.reportSpam}</option>
                    <option value="abuse">{t.reportAbuse}</option>
                    <option value="irrelevant">{t.reportIrrelevant}</option>
                    <option value="other">{t.reportOther}</option>
                  </select>
                  <input value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} maxLength={500} placeholder={t.reportDetails} />
                  <button className="review-submit" disabled={busy}>{t.submitReport}</button>
                </form>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="review-empty">{t.noReviewsYet}</div>
      )}
    </section>
  );
}
