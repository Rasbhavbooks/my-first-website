import { ArrowUpRight, Heart } from "lucide-react";
import { Link } from "react-router";
import { getBookTitle } from "../../data/books.js";
import { useWishlist } from "../../context/WishlistContext.jsx";
import { useCategories } from "../../hooks/useCategories.js";

export default function BookCard({ book, language, t }) {
  const title = getBookTitle(book, language);
  const { savedBookIds, toggleWishlist } = useWishlist();
  const { getCategoryLabel } = useCategories();
  const isSaved = savedBookIds.includes(book.id);

  return (
    <article className="book-card">
      <Link to={`/books/${book.id}`} className="book-card-link" aria-label={`${title} — ${t.viewDetails}`}>
        <div className={`book-cover cover-${book.tone}`} aria-label={`Cover artwork for ${title}`}>
          <span className="cover-badge">{book.badge}</span><span className="cover-title">{title}</span><span className="cover-author">{book.author}</span><span className="cover-seal">RB</span>
        </div>
        <div className="book-meta">
          <div className="book-labels"><span>{getCategoryLabel(book.category)}</span><span>{book.language}</span></div>
          <h3>{title}</h3><p>{t.by} {book.author}</p>
          <div className="book-bottom"><strong>₹{book.price}</strong><span className="icon-button" aria-hidden="true"><ArrowUpRight size={17} /></span></div>
        </div>
      </Link>
      <button
        className={isSaved ? "wishlist-toggle is-saved" : "wishlist-toggle"}
        type="button"
        aria-label={isSaved ? t.removeSaved : t.saveBook}
        aria-pressed={isSaved}
        title={isSaved ? t.removeSaved : t.saveBook}
        onClick={() => toggleWishlist(book.id)}
      >
        <Heart size={17} fill={isSaved ? "currentColor" : "none"} />
      </button>
    </article>
  );
}
