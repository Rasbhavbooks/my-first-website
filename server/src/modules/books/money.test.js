import assert from "node:assert/strict";
import test from "node:test";
import { inrPriceFromPaise, inrPriceToPaise } from "../../../../shared/money.js";
import Book from "./book.model.js";
import AuthorBook from "./author-book.model.js";
import mongoose from "mongoose";

test("INR price conversion preserves whole paise without floating-point rounding", () => {
  assert.equal(inrPriceToPaise(0), 0);
  assert.equal(inrPriceToPaise("249"), 24900);
  assert.equal(inrPriceToPaise("249.9"), 24990);
  assert.equal(inrPriceToPaise(0.29), 29);
  assert.equal(inrPriceFromPaise(29), 0.29);
});

test("INR prices reject fractions below paise and amounts above the configured maximum", () => {
  for (const value of ["1.001", 1.001, "-1", "Infinity", "", "100000.01"]) {
    assert.equal(inrPriceToPaise(value), null, String(value));
  }
  assert.equal(inrPriceFromPaise(1.5), null);
});

const localized = { en: "Sample", gu: "નમૂનો", hi: "नमूना" };

function validCatalogueBook(price) {
  return new Book({
    catalogueId: "money-test",
    title: localized,
    author: "Test Author",
    language: "English",
    category: "Novel",
    price,
    tone: "sage",
    badge: "TEST",
    description: localized,
  });
}

test("catalogue books accept at most two decimal places in rupee prices", async () => {
  await validCatalogueBook(10.29).validate();
  await assert.rejects(validCatalogueBook(10.291).validate(), /two decimal places/);
});

function validAuthorBook(price) {
  return new AuthorBook({
    authorId: new mongoose.Types.ObjectId(),
    authorName: "Test Author",
    title: localized,
    description: localized,
    language: "English",
    category: "Novel",
    price,
  });
}

test("author drafts accept at most two decimal places in rupee prices", async () => {
  await validAuthorBook(10.29).validate();
  await assert.rejects(validAuthorBook(10.291).validate(), /two decimal places/);
});

test("catalogue sale eligibility is private and defaults to unavailable", () => {
  const book = new Book({});
  assert.equal(book.availableForSale, false);
  assert.equal(Book.schema.path("availableForSale").options.select, false);
});
