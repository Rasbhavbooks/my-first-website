import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Link, Navigate, useParams } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { getReaderLibraryBook } from "../../services/readerLibraryService.js";

const styles = `
.reader-page{max-width:1180px;min-height:78vh;margin:auto;padding:36px 24px 64px}
.reader-toolbar{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:20px}
.reader-toolbar a{display:inline-flex;align-items:center;gap:7px;color:#635951;font-size:11px}
.reader-book-heading{margin:0 0 14px;color:#30252c;font:500 clamp(28px,4vw,42px)/1.12 var(--serif)}
.reader-book-meta{margin:0 0 18px;color:#77716a;font-size:12px}
.reader-frame{display:block;width:100%;height:min(78vh,1000px);min-height:520px;border:1px solid #d8cec1;background:#eee9e0}
.reader-error{max-width:700px;margin:25px auto;padding:24px;border:1px solid #ead2c9;background:#fff9f6;color:#863d32;font-size:13px;line-height:1.8}
.reader-open-link{display:inline-flex;align-items:center;gap:7px;padding:10px 13px;background:#30252c;color:#fff;text-decoration:none;font-size:11px}
.reader-loading{padding:24px;color:#77716a;font-size:12px}
@media(max-width:600px){.reader-page{padding:26px 14px 44px}.reader-frame{height:72vh;min-height:420px}}
`;

export default function ReaderBookPage() {
  const { bookId } = useParams();
  const { user, loading } = useAuth();
  const { language, t } = useLanguage();
  const [book, setBook] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!user?.id || !bookId) return () => { active = false; };
    setPageLoading(true);
    setError("");
    getReaderLibraryBook(bookId)
      .then((result) => { if (active) setBook(result); })
      .catch(() => { if (active) setError(t.readerAccessError); })
      .finally(() => { if (active) setPageLoading(false); });
    return () => { active = false; };
  }, [bookId, user?.id, t.readerAccessError]);

  if (loading) return <main className="reader-page"><p>{t.loadingAccount}</p></main>;
  if (!user) return <Navigate to="/reader/login" replace />;

  const title = book?.title?.[language] || book?.title?.en || "";
  const source = `/api/v1/books/${encodeURIComponent(bookId || "")}/read`;
  return (
    <main className="reader-page">
      <style>{styles}</style>
      <div className="reader-toolbar">
        <Link to="/library"><ArrowLeft size={15} />{t.readerBackLibrary}</Link>
        {book && <a className="reader-open-link" href={source} target="_blank" rel="noreferrer">{t.readerOpenTab}<ExternalLink size={14} /></a>}
      </div>
      {pageLoading ? <p className="reader-loading" aria-live="polite">{t.readerLoading}</p> : error ? (
        <div className="reader-error" role="alert"><h1>{t.readerPageTitle}</h1><p>{error}</p><Link to="/library">{t.readerBackLibrary}</Link></div>
      ) : book && (
        <>
          <h1 className="reader-book-heading">{title}</h1>
          <p className="reader-book-meta">{t.by} {book.author} · {book.accessKind === "free" ? t.libraryFreeLabel : t.libraryPurchasedLabel}</p>
          <iframe className="reader-frame" src={source} title={title || t.readerPageTitle} referrerPolicy="no-referrer" />
        </>
      )}
    </main>
  );
}
