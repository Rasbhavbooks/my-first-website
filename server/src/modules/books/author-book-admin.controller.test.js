import assert from "node:assert/strict";
import test from "node:test";
import { reviewAuthorBook } from "./author-book-admin.controller.js";
import AuthorBook from "./author-book.model.js";

const bookId = "507f1f77bcf86cd799439011";
const submittedAt = "2026-11-25T01:00:00.000Z";

function response() {
  return {
    status(code) { this.statusCode = code; return this; },
    setHeader() {},
    json(body) { this.body = body; return this; },
  };
}

test("price review matches the displayed submission and never overwrites the author's price", async t => {
  const updates = [];
  t.mock.method(AuthorBook, "findOneAndUpdate", async (filter, update) => {
    updates.push({ filter, update });
    return filter.price === 49.75 && filter.submittedAt.toISOString() === submittedAt
      ? { id: bookId, status: update.$set.status, price: filter.price } : null;
  });
  for (const [price, time, decision, expected] of [
    [49.75, submittedAt, "approved", 200],
    [49.75, submittedAt, "rejected", 200],
    [49, submittedAt, "approved", 409],
    [49.75, "2026-11-24T01:00:00.000Z", "approved", 409],
    [undefined, submittedAt, "approved", 400],
  ]) {
    const res = response();
    await reviewAuthorBook({
      params: { bookId }, reader: { _id: bookId },
      body: { decision, reviewedPrice: price, submittedAt: time, price: 1 },
    }, res);
    assert.equal(res.statusCode ?? 200, expected);
  }
  assert.equal(updates.length, 4);
  for (const { filter, update } of updates) {
    assert.equal(filter._id, bookId);
    assert.equal(filter.status, "submitted");
    assert.equal(Object.hasOwn(update.$set, "price"), false);
  }
});

test("an admin can approve a submitted free eBook at exactly zero rupees", async t => {
  t.mock.method(AuthorBook, "findOneAndUpdate", async (filter, update) => {
    assert.equal(filter.price, 0);
    assert.equal(Object.hasOwn(update.$set, "price"), false);
    return { id: bookId, price: 0, status: "approved" };
  });
  const res = response();
  await reviewAuthorBook({
    params: { bookId }, reader: { _id: bookId },
    body: { decision: "approved", reviewedPrice: 0, submittedAt },
  }, res);
  assert.equal(res.statusCode ?? 200, 200);
  assert.equal(res.body.data.book.price, 0);
});
