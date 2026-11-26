import assert from "node:assert/strict";
import test from "node:test";
import { createDuplicateRefundQueue } from "./refund-request.service.js";

const eventId = "507f1f77bcf86cd799439011";
const orderId = "507f1f77bcf86cd799439012";
const attemptId = "507f1f77bcf86cd799439013";
const session = { inTransaction: () => true };

function fixture({ event = {}, order = {}, attempt = {} } = {}) {
  const calls = [];
  const persisted = new Map();
  const records = {
    event: {
      _id: eventId, orderId, paymentAttemptId: attemptId,
      provider: "razorpay", eventId: "evt_duplicate", eventType: "payment.captured",
      providerOrderId: "order_test1", providerPaymentId: "pay_duplicate",
      amountPaise: 13929, currency: "INR", signatureVerifiedAt: new Date(), outcome: "applied",
      ...event,
    },
    order: {
      _id: orderId, status: "paid", amountPaise: 13929, currency: "INR",
      paymentProvider: "razorpay", paymentReference: "pay_original", ...order,
    },
    attempt: {
      _id: attemptId, orderId, provider: "razorpay", providerOrderId: "order_test1",
      amountPaise: 13929, currency: "INR", ...attempt,
    },
  };
  const queue = createDuplicateRefundQueue({
    findPaymentEventById: async (id, options) => { calls.push(["event", id, options]); return records.event; },
    findOrderById: async (id, options) => { calls.push(["order", id, options]); return records.order; },
    findAttemptById: async (id, options) => { calls.push(["attempt", id, options]); return records.attempt; },
    findBySourcePaymentEventId: async (id, options) => { calls.push(["find", id, options]); return persisted.get(String(id)) ?? null; },
    createRequest: async (data, options) => {
      calls.push(["create", data, options]);
      const request = { ...data, _id: "507f1f77bcf86cd799439099" };
      persisted.set(String(data.sourcePaymentEventId), request);
      return request;
    },
  });
  return { calls, persisted, records, queue };
}

test("queues a signed second payment once and snapshots its exact amount", async () => {
  const data = fixture();
  const first = await data.queue(eventId, { session });
  const retry = await data.queue(eventId, { session });
  assert.equal(first.replayed, false);
  assert.equal(retry.replayed, true);
  assert.equal(first.refundRequest.amountPaise, 13929);
  assert.equal(first.refundRequest.providerPaymentId, "pay_duplicate");
  assert.equal(first.refundRequest.reason, "duplicate_payment");
  assert.equal(data.calls.filter(([name]) => name === "create").length, 1);
  assert.ok(data.calls.every((call) => call.at(-1)?.session === session || call[0] === "create"));
});

test("rejects unsigned, original-payment, or mismatched captures", async (t) => {
  const cases = [
    ["unsigned", { event: { signatureVerifiedAt: null } }],
    ["original capture", { event: { providerPaymentId: "pay_original" } }],
    ["unpaid order", { order: { status: "pending_payment" } }],
    ["wrong amount", { event: { amountPaise: 13928 } }],
    ["wrong attempt", { attempt: { providerOrderId: "order_wrong" } }],
  ];
  for (const [label, data] of cases) {
    await t.test(label, async () => {
      const instance = fixture(data);
      await assert.rejects(instance.queue(eventId, { session }));
      assert.equal(instance.calls.some(([name]) => name === "create"), false);
    });
  }
});

test("requires the surrounding database transaction", async () => {
  const data = fixture();
  await assert.rejects(data.queue(eventId), { code: "TRANSACTION_REQUIRED" });
});
