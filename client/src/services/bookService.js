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


export async function getRelatedBooks(bookId, currentBook, limit = 4) {
  try {
    const result = await requestCatalogue(
      `/api/v1/books/${encodeURIComponent(bookId)}/related?limit=${limit}`,
    );
    if (Array.isArray(result)) return result;
  } catch {
    // Use the bundled sample catalogue when the API is unavailable in development.
  }

  const catalogue = await getBooks();
  return catalogue
    .filter((book) => book.id !== currentBook.id)
    .map((book) => ({
      book,
      score: (book.category === currentBook.category ? 4 : 0)
        + (book.language === currentBook.language ? 2 : 0)
        + (book.author === currentBook.author ? 3 : 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score
      || String(left.book.id).localeCompare(String(right.book.id)))
    .slice(0, limit)
    .map(({ book }) => book);
}

const CATALOGUE_PAGE_SIZE = 24;

function filterFallbackBooks(allBooks, { category, query, bookLanguage, sort, language }) {
  const locale = { en: "en-IN", gu: "gu-IN", hi: "hi-IN" }[language] || "en-IN";
  const term = query.trim().toLocaleLowerCase(locale);
  const filtered = allBooks.filter((book) => {
    const values = [
      ...Object.values(book.title || {}),
      ...Object.values(book.description || {}),
      book.author,
      book.category,
      book.language,
      book.isbn,
    ];
    const searchable = values.filter((value) => typeof value === "string").join(" ").toLocaleLowerCase(locale);
    return (category === "All" || book.category === category)
      && (!bookLanguage || book.language === bookLanguage)
      && searchable.includes(term);
  });
  if (sort === "title" || sort === "author") {
    const valueFor = (book) => sort === "author" ? book.author : (book.title?.[language] || book.title?.en || "");
    filtered.sort((a, b) => valueFor(a).localeCompare(valueFor(b), locale, { sensitivity: "base" })
      || String(a.id).localeCompare(String(b.id)));
  }
  return filtered;
}

export async function getBooksPage(filters) {
  const page = filters.page || 1;
  const params = new URLSearchParams({
    page: String(page),
    limit: String(CATALOGUE_PAGE_SIZE),
    q: filters.query || "",
    category: filters.category || "All",
    bookLanguage: filters.bookLanguage || "",
    sort: filters.sort || "featured",
    locale: filters.language || "en",
  });
  try {
    const result = await requestCatalogue("/api/v1/books?" + params.toString());
    if (result && Array.isArray(result.items)) return result;
  } catch {
    // Fall back to the sample catalogue when the API is unavailable in development.
  }
  const matches = filterFallbackBooks(await getBooks(), filters);
  const total = matches.length;
  const start = (page - 1) * CATALOGUE_PAGE_SIZE;
  return {
    items: matches.slice(start, start + CATALOGUE_PAGE_SIZE),
    page,
    limit: CATALOGUE_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / CATALOGUE_PAGE_SIZE)),
  };
}
