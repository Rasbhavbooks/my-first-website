import { ArrowUpRight, BookOpen } from "lucide-react";

export default function BookCard({ book, language, t }) {
  const title = language === "gu" ? book.gu : language === "hi" ? book.hi : book.title;
  return (
    <article className="book-card">
      <div className={`book-cover cover-${book.tone}`} aria-label={`Cover artwork for ${title}`}>
        <div className="cover-grain" />
        <span className="cover-mark">{book.mark} <i>✳</i></span>
        <span className="cover-title">{title}</span>
        <span className="cover-author">{book.author}</span>
        <span className="cover-seal">R<br/>B</span>
      </div>
      <div className="book-meta">
        <div><span className="book-category">{t.categories[book.category] || book.category}</span><span className="book-language">{book.language}</span></div>
        <h3>{title}</h3>
        <p>by {book.author}</p>
        <div className="book-bottom"><strong>₹{book.price}</strong><button className="icon-button" aria-label={`View ${title}`}><ArrowUpRight size={17}/></button></div>
      </div>
    </article>
  );
}
