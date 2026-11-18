import assert from "node:assert/strict";
import test from "node:test";
import { books, getBookTitle } from "./books.js";

test("sample catalogue has stable unique IDs", () => {
  const ids = books.map((book) => book.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("book titles use the selected language and fall back to English", () => {
  const sample = books[0];
  assert.equal(getBookTitle(sample, "gu"), "શબ્દોની વચ્ચે");
  assert.equal(getBookTitle(sample, "en"), "The Quiet Between");
  assert.equal(getBookTitle(sample, "unknown"), sample.title.en);
});
