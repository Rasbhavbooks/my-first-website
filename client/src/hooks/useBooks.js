import { useEffect, useMemo, useState } from "react";
import { getBooks } from "../services/bookService.js";
import { books as sampleBooks } from "../data/books.js";

export function useBooks() {
  const [books, setBooks] = useState(sampleBooks);
  useEffect(() => { getBooks().then(setBooks); }, []);
  return books;
}

export function useFilteredBooks(books, { category, query, language }) {
  return useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return books.filter((book) => {
      const title = book.title[language] || book.title.en;
      const matchesCategory = category === "All" || book.category === category;
      const searchable = [title, book.title.en, book.author, book.category, book.language].join(" ").toLocaleLowerCase();
      return matchesCategory && searchable.includes(term);
    });
  }, [books, category, query, language]);
}
