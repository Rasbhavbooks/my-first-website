import { useEffect, useState } from "react";
import BookCard from "./BookCard.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { getRelatedBooks } from "../../services/bookService.js";

const labels = {
  en: { title: "More stories to explore", description: "Books with a familiar language, category, or author." },
  gu: { title: "વાંચવા જેવી બીજી વાર્તાઓ", description: "તમારી પસંદની ભાષા, વિષય અથવા લેખકનાં પુસ્તકો." },
  hi: { title: "पढ़ने के लिए और कहानियाँ", description: "आपकी पसंद की भाषा, श्रेणी या लेखक की किताबें।" },
};

export default function RelatedBooks({ book, language, t }) {
  const { language: activeLanguage } = useLanguage();
  const [related, setRelated] = useState([]);

  useEffect(() => {
    let active = true;
    setRelated([]);
    getRelatedBooks(book.id, book).then((result) => {
      if (active) setRelated(result);
    });
    return () => { active = false; };
  }, [book.id, book.category, book.language, book.author]);

  if (!related.length) return null;
  const copy = labels[activeLanguage] || labels.en;

  return (
    <section className="related-books" aria-labelledby="related-books-title">
      <div className="related-books-heading">
        <div className="eyebrow"><i />{copy.description}</div>
        <h2 id="related-books-title">{copy.title}</h2>
      </div>
      <div className="book-grid">
        {related.map((item) => <BookCard key={item.id} book={item} language={language} t={t} />)}
      </div>
    </section>
  );
}
