import assert from "node:assert/strict";
import test from "node:test";
import { filterFallbackBooks, getBookById, getBooks, getBooksPage } from "./bookService.js";

test("catalogue service returns the sample books", async () => {
  const allBooks = await getBooks();
  assert.ok(allBooks.length > 0);
  assert.ok(allBooks.every((book) => book.id && book.title.en));
});

test("book lookup returns a matching book or null", async () => {
  assert.equal((await getBookById("b1")).title.en, "The Quiet Between");
  assert.equal(await getBookById("missing-book"), null);
});

test("catalogue fallback shows only zero-price books when free filter is selected", () => {
  const sample = [
    { id: "free-book", price: 0, title: { en: "Open Story" }, description: { en: "A free story" }, author: "Writer", category: "Novel", language: "English" },
    { id: "paid-book", price: 99, title: { en: "Paid Story" }, description: { en: "A paid story" }, author: "Writer", category: "Novel", language: "English" },
  ];
  const results = filterFallbackBooks(sample, {
    category: "All", query: "", bookLanguage: "", priceType: "free", sort: "featured", language: "en",
  });
  assert.deepEqual(results.map((book) => book.id), ["free-book"]);
});

test("catalogue page sends the selected price filter to the API", async () => {
  const previousFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return { ok: true, json: async () => ({ data: { items: [], page: 1, limit: 24, total: 0, totalPages: 1 } }) };
  };
  try {
    await getBooksPage({ page: 1, category: "All", query: "", language: "gu", bookLanguage: "", priceType: "free", sort: "featured" });
    const url = new URL(requestedUrl, "http://localhost");
    assert.equal(url.searchParams.get("priceType"), "free");
    assert.equal(url.searchParams.get("locale"), "gu");
  } finally {
    globalThis.fetch = previousFetch;
  }
});
