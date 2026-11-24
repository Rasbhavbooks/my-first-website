import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { createPaymentAttemptService } from "./payment-attempt.service.js";

const buyerId = "507f1f77bcf86cd799439011";
const orderId = "507f191e810c19729de860ea";
const session = { inTransaction: () => true };
const key = "reader-request-key-12345";

function fixture({ order = {}, existing = null, latest = null } = {}) {
  const calls = [];
  const service = createPaymentAttemptService({
    findOrderById: async (id, options) => {
      calls.push(["order", id, options]);
      return {
        _id: orderId,
        buyerId: new mongoose.Types.ObjectId(buyerId),
        status: "pending_payment",
        amountPaise: 4900,
        currency: "INR",
        ...order,
      };
    },
    findAttemptByIdempotency: async (id, hash, options) => {
      calls.push(["existing", id, hash, options]);
      return existing;
    },
    findLatestAttempt: async (id, options) => {
      calls.push(["latest", id, options]);
      return latest;
    },
    createAttempt: async (data, options) => {
      calls.push(["create", data, options]);
      return { _id: "attempt-new", ...data };
    },
  });
  return { calls, service };
}

test("creates a pending-order attempt from the server order snapshot inside a transaction", async () => {
  const data = fixture();
  const result = await data.service({
    buyerId,
    orderId,
    provider: "Cashfree",
    idempotencyKey: key,
  }, { session });
  assert.equal(result.replayed, false);
  assert.equal(result.attempt.status, "created");
  assert.equal(result.attempt.attemptNumber, 1);
  assert.equal(result.attempt.provider, "cashfree");
  assert.equal(result.attempt.amountPaise, 4900);
  assert.equal(result.attempt.currency, "INR");
  assert.match(data.calls.find(([name]) => name === "create")[1].idempotencyKeyHash, /^[a-f0-9]{64}$/);
  assert.equal(data.calls.find(([name]) => name === "create")[1].idempotencyKeyHash, createHash("sha256").update(key).digest("hex"));
  assert.equal(data.calls.find(([name]) => name === "create")[2].session, session);
});

test("returns the existing attempt for an identical key and provider", async () => {
  const existing = { _id: "attempt-existing", provider: "cashfree", status: "created" };
  const data = fixture({ existing });
  const result = await data.service({ buyerId, orderId, provider: "cashfree", idempotencyKey: key }, { session });
  assert.equal(result.replayed, true);
  assert.equal(result.attempt._id, "attempt-existing");
  assert.equal(data.calls.some(([name]) => name === "create"), false);
});

test("rejects reusing an idempotency key with another provider", async () => {
  const data = fixture({ existing: { provider: "cashfree" } });
  await assert.rejects(
    data.service({ buyerId, orderId, provider: "razorpay", idempotencyKey: key }, { session }),
    { code: "IDEMPOTENCY_KEY_REUSED" },
  );
});

test("keeps the same idempotent attempt replayable after its order is paid", async () => {
  const existing = { _id: "attempt-existing", provider: "cashfree", status: "captured" };
  const data = fixture({ existing, order: { status: "paid" } });
  const result = await data.service({ buyerId, orderId, provider: "cashfree", idempotencyKey: key }, { session });
  assert.equal(result.replayed, true);
  assert.equal(result.attempt.status, "captured");
  assert.equal(data.calls.some(([name]) => name === "create"), false);
});

test("permits a new attempt only after a failed or cancelled attempt", async (t) => {
  for (const status of ["failed", "cancelled"]) {
    await t.test(status, async () => {
      const data = fixture({ latest: { status, attemptNumber: 2 } });
      const result = await data.service({ buyerId, orderId, provider: "cashfree", idempotencyKey: key }, { session });
      assert.equal(result.attempt.attemptNumber, 3);
    });
  }
  for (const status of ["created", "pending", "authorized", "captured"]) {
    await t.test(`${status} blocks a second attempt`, async () => {
      const data = fixture({ latest: { status, attemptNumber: 1 } });
      await assert.rejects(
        data.service({ buyerId, orderId, provider: "cashfree", idempotencyKey: key }, { session }),
        { code: "PAYMENT_ATTEMPT_ACTIVE" },
      );
      assert.equal(data.calls.some(([name]) => name === "create"), false);
    });
  }
});

test("rejects unknown orders, other readers, paid orders, missing transactions, and invalid keys", async (t) => {
  const cases = [
    ["other reader", { order: { buyerId: new mongoose.Types.ObjectId() } }, { code: "ORDER_NOT_FOUND" }],
    ["paid order", { order: { status: "paid" } }, { code: "ORDER_NOT_PAYABLE" }],
    ["invalid provider", {}, { code: "PAYMENT_PROVIDER_NOT_CONFIGURED" }, "Bad Provider"],
    ["short key", {}, { code: "INVALID_IDEMPOTENCY_KEY" }, "short"],
  ];
  await assert.rejects(
    fixture().service({ buyerId, orderId, provider: "cashfree", idempotencyKey: key }),
    { code: "TRANSACTION_REQUIRED" },
  );
  for (const [label, overrides, expected, providerOrKey] of cases) {
    await t.test(label, async () => {
      const data = fixture(overrides);
      const isKey = label === "short key";
      await assert.rejects(data.service({
        buyerId,
        orderId,
        provider: isKey ? "cashfree" : providerOrKey || "cashfree",
        idempotencyKey: isKey ? providerOrKey : key,
      }, { session }), expected);
    });
  }
});
