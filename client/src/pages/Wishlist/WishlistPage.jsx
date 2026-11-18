import { Link } from "react-router";
import BookCard from "../../components/books/BookCard.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useBooks } from "../../hooks/useBooks.js";
import { useWishlist } from "../../context/WishlistContext.jsx";

export default function WishlistPage() {
  const { language, t } = useLanguage();
  const books = useBooks();
  const { savedBookIds } = useWishlist();
  const savedBooks = books.filter((book) => savedBookIds.includes(book.id));

  return (
    <main className="wishlist-page">
      <div className="eyebrow"><i />{t.readerSpace}</div>
      <h1>{t.wishlist}</h1>
      <p className="wishlist-intro">{t.wishlistIntro}</p>
      {savedBooks.length ? (
        <div className="book-grid">
          {savedBooks.map((book) => <BookCard key={book.id} book={book} language={language} t={t} />)}
        </div>
      ) : (
        <div className="wishlist-empty">
          <p>{t.wishlistEmpty}</p>
          <Link className="button button-dark" to="/">{t.explore}</Link>
        </div>
      )}
    </main>
  );
}
