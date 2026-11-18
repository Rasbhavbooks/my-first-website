import assert from "node:assert/strict";
import test from "node:test";
import { getBookById, getBooks } from "./bookService.js";

test("catalogue service returns the sample books", async () => {
  const allBooks = await getBooks();
  assert.ok(allBooks.length > 0);
  assert.ok(allBooks.every((book) => book.id && book.title.en));
});

test("book lookup returns a matching book or null", async () => {
  assert.equal((await getBookById("b1")).title.en, "The Quiet Between");
  assert.equal(await getBookById("missing-book"), null);
});
