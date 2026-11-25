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
  const freeCandidates = Array.from({ length: 21 }, (_value, index) => book(`free-${index}`));
  const entitlementCandidates = Array.from({ length: 21 }, (_value, index) => ({
    _id: new mongoose.Types.ObjectId(),
    bookId: `paid-${index}`,
  }));
  const paid = book("paid-0", 125);
  const readerId = new mongoose.Types.ObjectId();
  const controller = createReaderLibraryController({
    findFreeCandidates: async (_cursor, limit) => {
      assert.equal(limit, 21);
      return freeCandidates;
    },
    findEntitlements: async (ownerId, _cursor, limit) => {
      assert.equal(ownerId, readerId);
      assert.equal(limit, 21);
      return entitlementCandidates;
    },
    findBooksByIds: async (ids) => {
      assert.deepEqual(ids, entitlementCandidates.slice(0, 20).map((item) => item.bookId));
      return [paid];
    },
    findBookById: async () => null,
    resolveAccess: async ({ bookId }) => bookId === "free-1" || bookId === "paid-0"
      ? { kind: bookId === "paid-0" ? "purchased" : "free" }
      : null,
  });
  const response = responseMock();
  await controller.list({ query: {}, reader: { _id: readerId } }, response);
  assert.deepEqual(response.body.data.freeBooks.map((item) => item.id), ["free-1"]);
  assert.deepEqual(response.body.data.purchasedBooks.map((item) => item.id), ["paid-0"]);
  assert.equal(response.body.data.freeNextCursor, String(freeCandidates[19]._id));
  assert.equal(response.body.data.purchasedNextCursor, String(entitlementCandidates[19]._id));
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


test("library attaches only the signed-in reader's most recent open time", async () => {
  const free = book("free-book", 0);
  const readerId = new mongoose.Types.ObjectId();
  const lastOpenedAt = new Date("2026-11-25T00:00:00.000Z");
  const controller = createReaderLibraryController({
    findFreeCandidates: async () => [free],
    findEntitlements: async () => [],
    findBooksByIds: async () => [],
    findBookById: async () => null,
    resolveAccess: async () => ({ kind: "free" }),
    findProgress: async (ownerId, ids) => {
      assert.equal(ownerId, readerId);
      assert.deepEqual(ids, ["free-book"]);
      return [{ bookId: "free-book", lastOpenedAt }];
    },
  });
  const response = responseMock();
  await controller.list({ query: {}, reader: { _id: readerId } }, response);
  assert.equal(response.body.data.freeBooks[0].lastOpenedAt, lastOpenedAt.toISOString());
});


test("recent library lists only books the reader can still access", async () => {
  const older = book("older-book");
  const recent = book("recent-book");
  const hidden = book("revoked-book");
  const readerId = new mongoose.Types.ObjectId();
  const recentAt = new Date("2026-11-25T04:00:00.000Z");
  const controller = createReaderLibraryController({
    findFreeCandidates: async () => [],
    findEntitlements: async () => [],
    findBooksByIds: async (ids) => {
      assert.deepEqual(ids, ["recent-book", "revoked-book", "older-book"]);
      return [older, recent, hidden];
    },
    findBookById: async () => null,
    resolveAccess: async ({ bookId, readerId: owner }) => {
      assert.equal(owner, readerId);
      return bookId === "revoked-book" ? null : { kind: "free" };
    },
    findRecentActivities: async (owner, limit) => {
      assert.equal(owner, readerId);
      assert.equal(limit, 8);
      return [
        { bookId: "recent-book", lastOpenedAt: recentAt },
        { bookId: "revoked-book", lastOpenedAt: new Date("2026-11-25T03:00:00.000Z") },
        { bookId: "older-book", lastOpenedAt: new Date("2026-11-24T03:00:00.000Z") },
      ];
    },
  });
  const response = responseMock();
  await controller.listRecent({ reader: { _id: readerId } }, response);
  assert.equal(response.headers["Cache-Control"], "private, no-store");
  assert.deepEqual(response.body.data.books.map((item) => item.id), ["recent-book", "older-book"]);
  assert.equal(response.body.data.books[0].lastOpenedAt, recentAt.toISOString());
  assert.equal("privateKey" in response.body.data.books[0], false);
});
