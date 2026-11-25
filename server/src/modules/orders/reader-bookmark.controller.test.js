import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { createReaderBookmarkController } from "./reader-bookmark.controller.js";

function responseMock() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function makeController(overrides = {}) {
  return createReaderBookmarkController({
    resolveAccess: async () => ({ kind: "free" }),
    findBookmark: async () => null,
    saveBookmark: async (readerId, bookId, values) => ({ ...values, readerId, bookId, updatedAt: new Date("2026-11-25T00:00:00.000Z") }),
    deleteBookmark: async () => ({ deletedCount: 1 }),
    ...overrides,
  });
}

test("bookmark lookup is scoped to the signed-in reader and requires current book access", async () => {
  const readerId = new mongoose.Types.ObjectId();
  let owner;
  const controller = makeController({
    resolveAccess: async ({ readerId: id, bookId }) => {
      assert.equal(id, readerId);
      assert.equal(bookId, "book-1");
      return { kind: "free" };
    },
    findBookmark: async (id) => { owner = id; return { pageNumber: 12, note: "Start here", updatedAt: new Date("2026-11-25T00:00:00.000Z") }; },
  });
  const response = responseMock();

  await controller.get({ params: { bookId: "book-1" }, reader: { _id: readerId } }, response);

  assert.equal(owner, readerId);
  assert.equal(response.headers["Cache-Control"], "private, no-store");
  assert.deepEqual(response.body.data.bookmark, {
    pageNumber: 12,
    note: "Start here",
    updatedAt: "2026-11-25T00:00:00.000Z",
  });
});

test("bookmark lookup hides inaccessible books", async () => {
  const controller = makeController({ resolveAccess: async () => null });
  const response = responseMock();

  await controller.get({ params: { bookId: "book-1" }, reader: { _id: new mongoose.Types.ObjectId() } }, response);

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.error.code, "BOOK_NOT_FOUND");
});

test("bookmark save validates page, note and unexpected fields", async () => {
  const controller = makeController();
  const reader = { _id: new mongoose.Types.ObjectId() };
  for (const body of [
    { pageNumber: 0 },
    { pageNumber: 1.5 },
    { pageNumber: 100001 },
    { pageNumber: 3, note: "x".repeat(161) },
    { pageNumber: 3, readerId: String(reader._id) },
  ]) {
    const response = responseMock();
    await controller.save({ params: { bookId: "book-1" }, reader, body }, response);
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.error.code, "INVALID_BOOKMARK");
  }
});

test("bookmark save trims notes and stores under the signed-in reader", async () => {
  const readerId = new mongoose.Types.ObjectId();
  let saved;
  const controller = makeController({
    saveBookmark: async (...args) => { saved = args; return { pageNumber: 8, note: "Read later", updatedAt: null }; },
  });
  const response = responseMock();

  await controller.save({ params: { bookId: "book-1" }, reader: { _id: readerId }, body: { pageNumber: 8, note: "  Read later  " } }, response);

  assert.deepEqual(saved, [readerId, "book-1", { pageNumber: 8, note: "Read later" }]);
  assert.deepEqual(response.body.data.bookmark, { pageNumber: 8, note: "Read later", updatedAt: null });
});

test("reader can remove only their bookmark even if access was revoked", async () => {
  const readerId = new mongoose.Types.ObjectId();
  let deleted;
  const controller = makeController({
    deleteBookmark: async (...args) => { deleted = args; return { deletedCount: 1 }; },
  });
  const response = responseMock();

  await controller.remove({ params: { bookId: "book-1" }, reader: { _id: readerId } }, response);

  assert.deepEqual(deleted, [readerId, "book-1"]);
  assert.deepEqual(response.body.data, { removed: true });
});
