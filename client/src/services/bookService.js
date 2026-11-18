import { books } from "../data/books.js";

async function requestCatalogue(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Catalogue request failed with ${response.status}`);
  const result = await response.json();
  return result.data;
}

export async function getBooks() {
  try {
    const result = await requestCatalogue("/api/v1/books");
    return Array.isArray(result) ? result : books;
  } catch {
    // Keep the sample catalogue available if the API is not running in development.
    return books;
  }
}

export async function getBookById(bookId) {
  try {
    const result = await requestCatalogue(`/api/v1/books/${encodeURIComponent(bookId)}`);
    return result && typeof result === "object" ? result : null;
  } catch {
    return books.find((book) => book.id === bookId) || null;
  }
}
