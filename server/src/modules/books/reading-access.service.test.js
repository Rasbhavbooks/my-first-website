import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { createReadingAccessService } from "./reading-access.service.js";

const readerId = new mongoose.Types.ObjectId();
const sourceId = new mongoose.Types.ObjectId();

function makeService(overrides = {}) {
  const calls = [];
  const service = createReadingAccessService({
    findBook: async () => { calls.push("book"); return { price: 0, readingSourceId: sourceId }; },
    findApprovedSource: async () => { calls.push("source"); return { price: 0 }; },
    findEntitlement: async () => { calls.push("entitlement"); return { orderId: new mongoose.Types.ObjectId(), currency: "INR", amountPaise: 100 }; },
    findPaidOrder: async () => { calls.push("order"); return { currency: "INR", amountPaise: 100 }; },
    ...overrides,
  });
  return { service, calls };
}

test("a linked approved free eBook grants reading access without a paid order or entitlement", async () => {
  const { service, calls } = makeService({
    findEntitlement: async () => { calls.push("entitlement"); throw new Error("free books must not require payment"); },
    findPaidOrder: async () => { calls.push("order"); throw new Error("free books must not require payment"); },
  });

  const result = await service({ bookId: "free-book", readerId });

  assert.deepEqual(result, { sourceId: String(sourceId), kind: "free" });
  assert.deepEqual(calls, ["book", "source"]);
});

test("free reading is denied when there is no approved linked source or its price changed", async () => {
  const noSource = makeService({ findBook: async () => ({ price: 0, readingSourceId: null }) });
  assert.equal(await noSource.service({ bookId: "free-book", readerId }), null);
  assert.deepEqual(noSource.calls, ["book"]);

  const changedPrice = makeService({ findApprovedSource: async () => ({ price: 1 }) });
  assert.equal(await changedPrice.service({ bookId: "free-book", readerId }), null);
  assert.deepEqual(changedPrice.calls, ["book", "source"]);
});

test("paid reading requires a matching INR entitlement and paid order", async () => {
  const { service, calls } = makeService({
    findBook: async () => ({ price: 25, readingSourceId: sourceId }),
    findApprovedSource: async () => ({ price: 25 }),
    findEntitlement: async (owner, book) => {
      calls.push("entitlement");
      assert.equal(owner, readerId);
      assert.equal(book, "paid-book");
      return { orderId: new mongoose.Types.ObjectId(), currency: "INR", amountPaise: 2500 };
    },
    findPaidOrder: async (orderId, owner, book) => {
      calls.push("order");
      assert.equal(owner, readerId);
      assert.equal(book, "paid-book");
      return { currency: "INR", amountPaise: 2500 };
    },
  });

  assert.deepEqual(await service({ bookId: "paid-book", readerId }), {
    sourceId: String(sourceId),
    kind: "purchased",
  });
  assert.deepEqual(calls, ["book", "source", "entitlement", "order"]);
});

test("paid reading is denied without an entitlement or a matching valid paid order", async () => {
  const noEntitlement = makeService({
    findBook: async () => ({ price: 25, readingSourceId: sourceId }),
    findApprovedSource: async () => ({ price: 25 }),
    findEntitlement: async () => null,
  });
  assert.equal(await noEntitlement.service({ bookId: "paid-book", readerId }), null);
  assert.deepEqual(noEntitlement.calls, ["book", "source", "entitlement"]);

  for (const paidOrder of [
    null,
    { currency: "USD", amountPaise: 2500 },
    { currency: "INR", amountPaise: 2499 },
    { currency: "INR", amountPaise: 0 },
    { currency: "INR", amountPaise: Number.MAX_SAFE_INTEGER + 1 },
  ]) {
    const invalidOrder = makeService({
      findBook: async () => ({ price: 25, readingSourceId: sourceId }),
      findApprovedSource: async () => ({ price: 25 }),
      findEntitlement: async () => ({ orderId: new mongoose.Types.ObjectId(), currency: "INR", amountPaise: 2500 }),
      findPaidOrder: async () => paidOrder,
    });
    assert.equal(await invalidOrder.service({ bookId: "paid-book", readerId }), null);
  }
});

test("malformed reader and book identifiers are rejected before database lookups", async () => {
  const { service, calls } = makeService();
  assert.equal(await service({ bookId: "free-book", readerId: "not-an-id" }), null);
  assert.equal(await service({ bookId: " padded ", readerId }), null);
  assert.deepEqual(calls, []);
});
