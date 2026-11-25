import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router";
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

export default function BookDetailsPage() {
  const { bookId } = useParams();
  const { language, t } = useLanguage();
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

  return (
    <main className="detail-page">
      <style>{`.detail-reading-action{display:inline-flex;align-items:center;justify-content:center;min-height:42px;margin:4px 0 8px;padding:0 18px;background:#30252c;color:#fff;text-decoration:none;font-size:10px;letter-spacing:.04em}.detail-access-note{margin:5px 0 14px;color:#77716a;font-size:11px;line-height:1.7}.detail-access-error{color:#863d32}`}</style>
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
          <div className="detail-price">{book.price === 0 ? t.freeBookPrice : formatInr(book.price, language)}</div>
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
      <RelatedBooks book={book} language={language} t={t} />
    </main>
  );
}
