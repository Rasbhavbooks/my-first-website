import { useEffect, useMemo, useState } from "react";
import { getBooks, getBooksPage } from "../services/bookService.js";
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


export function usePaginatedBooks({ category, query, language, bookLanguage, sort, page }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      getBooksPage({ category, query, language, bookLanguage, sort, page })
        .then((result) => {
          if (!active) return;
          setItems((current) => page === 1 ? result.items : [...current, ...result.items]);
          setTotal(result.total);
          setTotalPages(result.totalPages);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, query ? 250 : 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [category, query, language, bookLanguage, sort, page]);

  return { items, total, totalPages, loading, hasMore: page < totalPages };
}
