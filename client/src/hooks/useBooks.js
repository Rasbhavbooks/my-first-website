import { useEffect, useMemo, useState } from "react";
import { getBooks } from "../services/bookService.js";
import { books as sampleBooks } from "../data/books.js";

export function useBooks() {
  const [books, setBooks] = useState(sampleBooks);
  useEffect(() => { getBooks().then(setBooks); }, []);
  return books;
}

export function useFilteredBooks(books, { category, query, language, bookLanguage = "", sort = "featured" }) {
  return useMemo(() => {
    const locale = { en: "en-IN", gu: "gu-IN", hi: "hi-IN" }[language] || "en-IN";
    const term = query.trim().toLocaleLowerCase(locale);
    const filtered = books.filter((book) => {
      const searchableValues = [
        ...Object.values(book.title || {}),
        ...Object.values(book.description || {}),
        book.author,
        book.category,
        book.language,
        book.isbn,
      ];
      const searchable = searchableValues.filter((value) => typeof value === "string").join(" ").toLocaleLowerCase(locale);
      const matchesCategory = category === "All" || book.category === category;
      const matchesLanguage = !bookLanguage || book.language === bookLanguage;
      return matchesCategory && matchesLanguage && searchable.includes(term);
    });
    if (sort === "title" || sort === "author") {
      const valueFor = (book) => sort === "author" ? book.author : (book.title?.[language] || book.title?.en || "");
      return [...filtered].sort((a, b) => valueFor(a).localeCompare(valueFor(b), locale, { sensitivity: "base" })
        || String(a.id).localeCompare(String(b.id)));
    }
    return filtered;
  }, [books, bookLanguage, category, language, query, sort]);
}
