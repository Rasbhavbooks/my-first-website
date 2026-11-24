import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { createPendingOrderService } from "./order.service.js";

const buyerId = "64c0ffee0000000000000001";
const bookId = "quiet-river";
const key = "reader-request-2026-0001";
const book = {
  catalogueId: bookId,
  title: { en: "Quiet River", gu: "શાંત નદી", hi: "शांत नदी" },
  author: "A. Writer",
  price: 0.29,
};

function makeStore(availableBook = book) {
  const orders = new Map();
  let createCount = 0;
  return {
    orders,
    get createCount() { return createCount; },
    findBook: async (id) => id === availableBook?.catalogueId ? availableBook : null,
    findOrder: async (readerId, hash) => orders.get(`${readerId}:${hash}`) ?? null,
    create: async (orderData) => {
      createCount += 1;
      const index = `${orderData.buyerId}:${orderData.idempotencyKeyHash}`;
      if (orders.has(index)) {
        const duplicate = new Error("duplicate key");
        duplicate.code = 11000;
        throw duplicate;
      }
      const order = { ...orderData };
      orders.set(index, order);
      return order;
    },
  };
}

function makeService(store) {
  return createPendingOrderService({
    findAvailableBook: store.findBook,
    findExistingOrder: store.findOrder,
    createOrder: store.create,
  });
}

test("creates a pending one-book INR order using the catalogue price in exact paise", async () => {
  const store = makeStore();
  const result = await makeService(store)({ buyerId, bookId, idempotencyKey: key });

  assert.equal(result.replayed, false);
  assert.equal(result.order.amountPaise, 29);
  assert.equal(result.order.bookId, bookId);
  assert.equal(result.order.currency, "INR");
  assert.equal(result.order.status, "pending_payment");
  assert.equal(result.order.idempotencyKey, undefined);
  assert.match(result.order.idempotencyKeyHash, /^[a-f0-9]{64}$/);
  assert.equal(store.createCount, 1);
});

test("refuses books that are not explicitly enabled for sale", async () => {
  const store = makeStore(null);
  await assert.rejects(
    makeService(store)({ buyerId, bookId, idempotencyKey: key }),
    { code: "BOOK_NOT_FOR_SALE" },
  );
  assert.equal(store.createCount, 0);
});

test("replays the same reader request without creating a duplicate order", async () => {
  const store = makeStore();
  const service = makeService(store);
  const first = await service({ buyerId, bookId, idempotencyKey: key });
  const retry = await service({ buyerId, bookId, idempotencyKey: key });

  assert.equal(retry.replayed, true);
  assert.equal(retry.order, first.order);
  assert.equal(store.createCount, 1);
});

test("rejects an idempotency key reused for a different book", async () => {
  const store = makeStore();
  const service = makeService(store);
  await service({ buyerId, bookId, idempotencyKey: key });

  await assert.rejects(
    service({ buyerId, bookId: "different-book", idempotencyKey: key }),
    { code: "IDEMPOTENCY_KEY_REUSED" },
  );
  assert.equal(store.createCount, 1);
});

test("rejects invalid reader IDs, weak keys, and free or invalid prices", async () => {
  const store = makeStore();
  const service = makeService(store);
  await assert.rejects(service({ buyerId: "bad-id", bookId, idempotencyKey: key }), { code: "INVALID_BUYER" });
  await assert.rejects(service({ buyerId, bookId, idempotencyKey: "short" }), { code: "INVALID_IDEMPOTENCY_KEY" });

  const freeBook = makeStore({ ...book, price: 0 });
  await assert.rejects(makeService(freeBook)({ buyerId, bookId, idempotencyKey: key }), { code: "INVALID_BOOK_PRICE" });
  assert.equal(store.createCount, 0);
  assert.equal(freeBook.createCount, 0);
});

test("recovers an identical duplicate-key race as a replay", async () => {
  let existing = null;
  const createOrder = async (orderData) => {
    existing = { ...orderData };
    const duplicate = new Error("duplicate key");
    duplicate.code = 11000;
    throw duplicate;
  };
  const service = createPendingOrderService({
    findAvailableBook: async () => book,
    findExistingOrder: async () => existing,
    createOrder,
  });
  const result = await service({ buyerId: new mongoose.Types.ObjectId().toString(), bookId, idempotencyKey: key });

  assert.equal(result.replayed, true);
  assert.equal(result.order, existing);
});
