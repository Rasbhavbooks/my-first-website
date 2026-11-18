import { ArrowUpRight } from "lucide-react";
import { getBookTitle } from "../../data/books.js";

export default function BookCard({ book, language, t }) {
  return (
    <article className="book-card">
      <div className={`book-cover cover-${book.tone}`} aria-label={`Cover artwork for ${getBookTitle(book, language)}`}>
        <span className="cover-badge">{book.badge}</span><span className="cover-title">{getBookTitle(book, language)}</span><span className="cover-author">{book.author}</span><span className="cover-seal">RB</span>
      </div>
      <div className="book-meta">
        <div className="book-labels"><span>{t.categories[book.category]}</span><span>{book.language}</span></div>
        <h3>{getBookTitle(book, language)}</h3><p>{t.by} {book.author}</p>
        <div className="book-bottom"><strong>₹{book.price}</strong><button type="button" className="icon-button" aria-label={getBookTitle(book, language)}><ArrowUpRight size={17} /></button></div>
      </div>
    </article>
  );
}
