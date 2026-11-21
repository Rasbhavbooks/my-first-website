import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router";
import { getBookTitle } from "../../data/books.js";
import BookReviews from "../../components/books/BookReviews.jsx";
import AuthorFollowButton from "../../components/books/AuthorFollowButton.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useCategories } from "../../hooks/useCategories.js";
import { getBookById } from "../../services/bookService.js";

export default function BookDetailsPage() {
  const { bookId } = useParams();
  const { language, t } = useLanguage();
  const { getCategoryLabel } = useCategories();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <main className="detail-state" aria-live="polite">{t.loading}</main>;
  if (!book) return <main className="detail-state"><h1>{t.notFound}</h1><Link className="button button-dark" to="/">{t.backHome}</Link></main>;

  const title = getBookTitle(book, language);
  return (
    <main className="detail-page">
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
          <div className="detail-price">₹{book.price}</div>
          <p className="detail-description">{t.descriptionText[language]}</p>
          <dl className="detail-facts">
            <div><dt>{t.languageLabel}</dt><dd>{book.language}</dd></div>
            <div><dt>{t.categoryLabel}</dt><dd>{getCategoryLabel(book.category)}</dd></div>
          </dl>
          <p className="demo-note">{t.demoNotice}</p>
        </article>
      </div>
      <BookReviews bookId={book.id} />
    </main>
  );
}
