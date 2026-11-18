import { books } from "../data/books.js";

// Local catalogue adapter for Phase 1. Replace this with Axios API calls in the reader phase.
export async function getBooks() {
  return books;
}

export async function getBookById(bookId) {
  return books.find((book) => book.id === bookId) || null;
}
