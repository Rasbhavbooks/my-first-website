import { BookDiscussion } from "../../components/books/BookDiscussion.jsx";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router";
import { getBookTitle } from "../../data/books.js";
import BookReviews from "../../components/books/BookReviews.jsx";
import RelatedBooks from "../../components/books/RelatedBooks.jsx";
import AuthorFollowButton from "../../components/books/AuthorFollowButton.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useCategories } from "../../hooks/useCategories.js";
import { getBookById } from "../../services/bookService.js";
import { usePageMetadata } from "../../hooks/usePageMetadata.js";
import { formatInr } from "../../utils/formatCurrency.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { getReaderLibraryBook } from "../../services/readerLibraryService.js";

function ShareReferral({ bookId, language }) {
  const [link, setLink] = useState("");
  const [status, setStatus] = useState("idle");
  const labels = ({
    gu: ["રેફરલ લિંક કૉપી કરો", "લિંક કૉપી થઈ", "લિંક મેળવવા ફરી પ્રયાસ કરો"],
    hi: ["रेफरल लिंक कॉपी करें", "लिंक कॉपी हुआ", "लिंक पाने के लिए फिर कोशिश करें"],
    en: ["Copy referral link", "Link copied", "Try again to get your link"],
  })[language] || ["Copy referral link", "Link copied", "Try again to get your link"];

  async function share() {
    setStatus("loading");
    try {
      const response = await fetch("/api/v1/books/referral-code", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error();
      const { data } = await response.json();
      if (!/^[a-f0-9]{32}$/.test(data?.code)) throw new Error();
      const url = new URL("/books/" + encodeURIComponent(bookId), window.location.origin);
      url.searchParams.set("ref", data.code);
      setLink(url.href);
      try {
        await navigator.clipboard.writeText(url.href);
        setStatus("copied");
      } catch {
        setStatus("manual");
      }
    } catch {
      setStatus("error");
    }
  }

  return <div>
    <button type="button" onClick={share} disabled={status === "loading"}>{labels[0]}</button>
    {link && <input aria-label={labels[0]} readOnly value={link} onFocus={event => event.target.select()} />}
    <span role="status">{status === "copied" ? labels[1] : status === "error" ? labels[2] : ""}</span>
  </div>;
}

export default function BookDetailsPage() {
  const { bookId } = useParams();
  const { language, t } = useLanguage();
  const [params] = useSearchParams();
  const referralCode = params.get("ref") ?? "";
  const referralQuery = /^[a-f0-9]{32}$/.test(referralCode) ? new URLSearchParams({ ref: referralCode }) : new URLSearchParams();
  const bookSearch = referralQuery.toString();
  referralQuery.set("checkout", "preview");
  const checkoutSearch = referralQuery.toString();
  const previewLabel = { gu: "ટેસ્ટ ચેકઆઉટ", hi: "टेस्ट चेकआउट", en: "Test checkout" }[language] || "Test checkout";
  const { getCategoryLabel } = useCategories();
  const { user, loading: authLoading } = useAuth();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [readerAccess, setReaderAccess] = useState({ status: "idle" });

  useEffect(() => {
    let active = true;
    setLoading(true);
    getBookById(bookId).then((result) => {
      if (active) {
        setBook(result);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [bookId]);

  useEffect(() => {
    let active = true;
    if (!book?.id || authLoading) return () => { active = false; };
    if (!user?.id) {
      setReaderAccess({ status: "guest" });
      return () => { active = false; };
    }
    setReaderAccess({ status: "checking" });
    getReaderLibraryBook(book.id)
      .then((accessibleBook) => { if (active) setReaderAccess({ status: "available", book: accessibleBook }); })
      .catch((error) => {
        if (!active) return;
        setReaderAccess({ status: error.status === 404 ? "unavailable" : "error" });
      });
    return () => { active = false; };
  }, [book?.id, user?.id, authLoading]);

  const title = book ? getBookTitle(book, language) : "";
  const customerPrice = book && Number.isSafeInteger(book.customerPricePaise)
    ? book.customerPricePaise / 100
    : book?.price;
  usePageMetadata({
    title: book ? `${title} — ${book.author} | Rasbhav Books` : "",
    description: book?.description?.[language] || book?.description?.en || "",
    type: "book",
    structuredData: book ? {
      "@context": "https://schema.org",
      "@type": "Book",
      name: title,
      description: book.description?.[language] || book.description?.en || "",
      author: { "@type": "Person", name: book.author },
      isbn: book.isbn || undefined,
      url: typeof window === "undefined" ? "" : window.location.href.split("?")[0],
    } : null,
  });

  if (loading) return <main className="detail-state" aria-live="polite">{t.loading}</main>;
  if (!book) return <main className="detail-state"><h1>{t.notFound}</h1><Link className="button button-dark" to="/">{t.backHome}</Link></main>;

  if (params.get("checkout") === "preview" && customerPrice > 0 && book.priceBreakdownPaise) {
    return (
      <main className="detail-state">
        <h1>{previewLabel}</h1>
        <h2>{title}</h2>
        <p>{t.priceAuthorShare} · {formatInr(book.priceBreakdownPaise.authorPrice / 100, language)}</p>
        <p>{t.pricePlatformPool} · {formatInr(book.priceBreakdownPaise.platformCommission / 100, language)}</p>
        <p>{t.priceGst} · {formatInr(book.priceBreakdownPaise.gst / 100, language)}</p>
        <p>{t.priceGateway} · {formatInr(book.priceBreakdownPaise.gatewayFee / 100, language)}</p>
        <strong>{t.priceBreakdownTitle} · {formatInr(customerPrice, language)}</strong>
        <p>{t.testPriceDisclaimer}</p>
        <Link to={{ pathname: `/books/${encodeURIComponent(bookId)}`, search: bookSearch }}>{title}</Link>
      </main>
    );
  }

  return (
    <main className="detail-page">
      <style>{`.detail-reading-action{display:inline-flex;align-items:center;justify-content:center;min-height:42px;margin:4px 0 8px;padding:0 18px;background:#30252c;color:#fff;text-decoration:none;font-size:10px;letter-spacing:.04em}.detail-access-note{margin:5px 0 14px;color:#77716a;font-size:11px;line-height:1.7}.detail-access-error{color:#863d32}.detail-price-breakdown{margin:2px 0 16px;color:#655c57;font-size:12px}.detail-price-breakdown summary{cursor:pointer;font-weight:600}.detail-price-breakdown dl{max-width:310px;margin:10px 0}.detail-price-breakdown dl div{display:flex;justify-content:space-between;gap:20px;padding:4px 0}.detail-price-breakdown dd{margin:0;font-variant-numeric:tabular-nums}.detail-price-breakdown-total{border-top:1px solid #d8d1ca;font-weight:700}.detail-price-breakdown p{max-width:380px;font-size:11px;line-height:1.5}` }</style>
      <Link to="/#discover" className="back-link"><ArrowLeft size={16} />{t.backToCatalogue}</Link>
      <div className="detail-grid">
        <div className={`book-cover detail-cover cover-${book.tone}`}>
          <span className="cover-badge">{book.badge}</span><span className="cover-title">{title}</span><span className="cover-author">{book.author}</span><span className="cover-seal">RB</span>
        </div>
        <article className="detail-copy">
          <div className="eyebrow"><i />{t.bookDetails}</div>
          <h1>{title}</h1>
          <p className="detail-author">{t.by} <strong>{book.author}</strong></p>
          <AuthorFollowButton authorName={book.author} />
          <div className="detail-price">{customerPrice === 0 ? t.freeBookPrice : formatInr(customerPrice, language)}</div>
          {customerPrice > 0 && user?.role === "reader" && <ShareReferral key={bookId + user.id} bookId={bookId} language={language} />}
          {customerPrice > 0 && book.priceBreakdownPaise && <Link className="detail-reading-action" to={{ search: checkoutSearch }}>{previewLabel}</Link>}
          {customerPrice > 0 && book.priceBreakdownPaise && (
            <details className="detail-price-breakdown">
              <summary>{t.priceBreakdownTitle}</summary>
              <dl>
                <div><dt>{t.priceAuthorShare}</dt><dd>{formatInr(book.priceBreakdownPaise.authorPrice / 100, language)}</dd></div>
                <div><dt>{t.pricePlatformPool}</dt><dd>{formatInr(book.priceBreakdownPaise.platformCommission / 100, language)}</dd></div>
                <div><dt>{t.priceGst}</dt><dd>{formatInr(book.priceBreakdownPaise.gst / 100, language)}</dd></div>
                <div><dt>{t.priceGateway}</dt><dd>{formatInr(book.priceBreakdownPaise.gatewayFee / 100, language)}</dd></div>
                <div className="detail-price-breakdown-total"><dt>{t.priceBreakdownTitle}</dt><dd>{formatInr(book.priceBreakdownPaise.total / 100, language)}</dd></div>
              </dl>
              <p>{t.testPriceDisclaimer}</p>
            </details>
          )}
          {readerAccess.status === "available" ? (
            <Link className="detail-reading-action" to={`/read/${encodeURIComponent(book.id)}`}>{t.readEbook}</Link>
          ) : book.price === 0 && readerAccess.status === "guest" ? (
            <Link className="detail-reading-action" to="/reader/login">{t.freeBookSignIn}</Link>
          ) : readerAccess.status === "checking" ? (
            <p className="detail-access-note" role="status">{t.checkingBookAccess}</p>
          ) : readerAccess.status === "error" ? (
            <p className="detail-access-note detail-access-error" role="alert">{t.bookAccessCheckError}</p>
          ) : book.price === 0 && readerAccess.status === "unavailable" ? (
            <p className="detail-access-note">{t.freeBookNotAvailable}</p>
          ) : book.price > 0 ? (
            <p className="detail-access-note">{t.paidPurchaseUnavailable}</p>
          ) : null}
          <p className="detail-description">{t.descriptionText[language]}</p>
          <dl className="detail-facts">
            <div><dt>{t.languageLabel}</dt><dd>{book.language}</dd></div>
            <div><dt>{t.categoryLabel}</dt><dd>{getCategoryLabel(book.category)}</dd></div>
            {book.isbn && <div><dt>{t.bookIsbn}</dt><dd>{book.isbn}</dd></div>}
          </dl>

        </article>
      </div>
      <BookReviews bookId={book.id} />
      <BookDiscussion key={book.id} bookId={book.id} />
      <RelatedBooks book={book} language={language} t={t} />
    </main>
  );
}
