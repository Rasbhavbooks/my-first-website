import assert from "node:assert/strict";
import test from "node:test";
import { getReaderLibrary, getReaderLibraryBook } from "./readerLibraryService.js";

test("library request uses reader credentials, no-store cache and independent cursors", async () => {
  const previousFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return { ok: true, json: async () => ({ data: { freeBooks: [], purchasedBooks: [] } }) };
  };
  try {
    await getReaderLibrary({ freeCursor: "free-cursor", purchasedCursor: "paid-cursor" });
    assert.equal(captured.url, "/api/v1/reader/library?freeCursor=free-cursor&purchasedCursor=paid-cursor");
    assert.equal(captured.options.credentials, "include");
    assert.equal(captured.options.cache, "no-store");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("single-book library request encodes the catalogue identifier", async () => {
  const previousFetch = globalThis.fetch;
  let capturedUrl = "";
  globalThis.fetch = async (url) => {
    capturedUrl = url;
    return { ok: true, json: async () => ({ data: { book: { id: "book-id", accessKind: "free" } } }) };
  };
  try {
    const book = await getReaderLibraryBook("book id");
    assert.equal(capturedUrl, "/api/v1/reader/library/book%20id");
    assert.equal(book.accessKind, "free");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("library request reports a safe API error code", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    json: async () => ({ error: { code: "NOT_AUTHENTICATED", message: "Sign in to continue." } }),
  });
  try {
    await assert.rejects(getReaderLibrary(), (error) => error.status === 401 && error.code === "NOT_AUTHENTICATED");
  } finally {
    globalThis.fetch = previousFetch;
  }
});
