import { useMemo } from "react";
import { getCatalogueBooks } from "../services/catalogueService.js";

export function useBookCatalogue({ category, query }) {
  return useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return getCatalogueBooks().filter((book) => {
      const categoryMatch = category === "All books" || book.category === category;
      const searchable = [book.title, book.gu, book.hi, book.author, book.category, book.language]
        .join(" ")
        .toLocaleLowerCase();
      return categoryMatch && searchable.includes(normalizedQuery);
    });
  }, [category, query]);
}
