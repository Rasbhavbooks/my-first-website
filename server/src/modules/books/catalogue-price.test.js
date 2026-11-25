import assert from "node:assert/strict";
import test from "node:test";
import Book from "./book.model.js";
import Category from "./category.model.js";
import { updateAdminCatalogueBook } from "./catalogue-admin.controller.js";

test("catalogue metadata edits cannot change the price", async t => {
  const localized = { en: "River", gu: "નદી", hi: "नदी" };
  const record = { catalogueId: "river", price: 49.75 };
  t.mock.method(Category, "exists", async () => true);
  t.mock.method(Book, "exists", async () => true);
  t.mock.method(Book, "findOneAndUpdate", (filter, { $set }) => {
    assert.equal(filter.catalogueId, record.catalogueId);
    assert.equal(Object.hasOwn($set, "price"), false);
    return { lean: async () => filter.price === record.price ? { ...record, ...$set } : null };
  });
  for (const [price, expected] of [[49.75, 200], [1, 409]]) {
    const res = { statusCode: 200, setHeader() {}, json() {}, status(code) { this.statusCode = code; return this; } };
    await updateAdminCatalogueBook({
      params: { bookId: record.catalogueId },
      body: { price, language: "Gujarati", category: "Novel", title: localized, description: localized, tone: "blue", badge: "New" },
    }, res);
    assert.equal(res.statusCode, expected);
  }
});
