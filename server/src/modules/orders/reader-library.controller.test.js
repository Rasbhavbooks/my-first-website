import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { createReaderLibraryController } from "./reader-library.controller.js";

function responseMock() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function book(catalogueId, price = 0) {
  return {
    _id: new mongoose.Types.ObjectId(),
    catalogueId,
    title: { en: "Safe title", gu: "સુરક્ષિત નામ", hi: "सुरक्षित नाम" },
    author: "A. Writer",
    language: "English",
    category: "Novel",
    price,
    tone: "plum",
    badge: "New",
    privateKey: "never-return",
  };
}

test("library lists only free books that pass reader access checks", async () => {
  const free = book("free-book", 0);
  const unlinked = book("unlinked-book", 0);
  const readerId = new mongoose.Types.ObjectId();
  const controller = createReaderLibraryController({
    findFreeCandidates: async () => [free, unlinked],
    findEntitlements: async () => [],
    findBooksByIds: async () => [],
    findBookById: async () => null,
    resolveAccess: async ({ bookId, readerId: id }) => {
      assert.equal(id, readerId);
      return bookId === "free-book" ? { kind: "free", sourceId: "private" } : null;
    },
  });
  const response = responseMock();

  await controller.list({ query: {}, reader: { _id: readerId } }, response);

  assert.equal(response.headers["Cache-Control"], "private, no-store");
  assert.deepEqual(response.body.data.freeBooks.map((item) => item.id), ["free-book"]);
  assert.deepEqual(response.body.data.purchasedBooks, []);
  assert.equal("privateKey" in response.body.data.freeBooks[0], false);
});

test("library limits candidates and advances independent section cursors", async () => {
  const firstFree = book("free-first");
  const secondFree = book("free-second");
  const firstEntitlement = { _id: new mongoose.Types.ObjectId(), bookId: "paid-first" };
  const secondEntitlement = { _id: new mongoose.Types.ObjectId(), bookId: "paid-second" };
  const paid = book("paid-first", 125);
  const controller = createReaderLibraryController({
    findFreeCandidates: async (_cursor, limit) => {
      assert.equal(limit, 21);
      return [firstFree, secondFree, book("free-overflow")];
    },
    findEntitlements: async (_readerId, _cursor, limit) => {
      assert.equal(limit, 21);
      return [firstEntitlement, secondEntitlement, { _id: new mongoose.Types.ObjectId(), bookId: "paid-overflow" }];
    },
    findBooksByIds: async (ids) => {
      assert.deepEqual(ids, ["paid-first", "paid-second"]);
      return [paid];
    },
    findBookById: async () => null,
    resolveAccess: async ({ bookId }) => bookId === "free-second" || bookId === "paid-first"
      ? { kind: bookId === "paid-first" ? "purchased" : "free" }
      : null,
  });
  const response = responseMock();
  await controller.list({ query: {}, reader: { _id: new mongoose.Types.ObjectId() } }, response);
  assert.deepEqual(response.body.data.freeBooks.map((item) => item.id), ["free-second"]);
  assert.deepEqual(response.body.data.purchasedBooks.map((item) => item.id), ["paid-first"]);
  assert.equal(response.body.data.freeNextCursor, String(secondFree._id));
  assert.equal(response.body.data.purchasedNextCursor, String(secondEntitlement._id));
});

test("library rejects malformed cursors", async () => {
  const controller = createReaderLibraryController({
    findFreeCandidates: async () => [],
    findEntitlements: async () => [],
    findBooksByIds: async () => [],
    findBookById: async () => null,
    resolveAccess: async () => null,
  });
  const response = responseMock();
  await controller.list({ query: { freeCursor: "bad" }, reader: { _id: new mongoose.Types.ObjectId() } }, response);
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.code, "INVALID_LIBRARY_CURSOR");
});

test("single-book library lookup returns no metadata without access", async () => {
  const secretBook = book("not-owned", 500);
  const controller = createReaderLibraryController({
    findFreeCandidates: async () => [],
    findEntitlements: async () => [],
    findBooksByIds: async () => [],
    findBookById: async () => secretBook,
    resolveAccess: async () => null,
  });
  const response = responseMock();
  await controller.getBook({ params: { bookId: "not-owned" }, reader: { _id: new mongoose.Types.ObjectId() } }, response);
  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body.error.code, "BOOK_NOT_FOUND");
});
