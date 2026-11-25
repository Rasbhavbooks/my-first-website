import assert from "node:assert/strict";
import test from "node:test";
import { createRazorpayOrderService } from "./razorpay-order.service.js";

const attemptId = "507f1f77bcf86cd799439011";
const localOrderId = "507f1f77bcf86cd799439012";
const buyerId = "507f1f77bcf86cd799439013";

function fixture({ existingProviderOrderId = "", status = "created", gatewayError = null } = {}) {
  const calls = [];
  const attempt = {
    _id: attemptId,
    orderId: localOrderId,
    provider: "razorpay",
    amountPaise: 1250,
    currency: "INR",
    status,
    providerOrderId: existingProviderOrderId,
    attachProviderOrderId(id) { this.providerOrderId = id; },
    transitionTo(next) { this.status = next; },
  };
  const order = { _id: localOrderId, buyerId, status: "pending_payment", amountPaise: 1250, currency: "INR" };
  const service = createRazorpayOrderService({
    findAttemptById: async (id) => { calls.push(["attempt", id]); return attempt; },
    findOrderById: async (id) => { calls.push(["order", id]); return order; },
    createProviderOrder: async (input) => {
      calls.push(["create", input]);
      if (gatewayError) throw gatewayError;
      return { id: "order_test123", amountPaise: 1250, currency: "INR", receipt: input.receipt };
    },
    findProviderOrderByReceipt: async (input) => {
      calls.push(["lookup", input.receipt]);
      return gatewayError ? { id: "order_recovered", amountPaise: 1250, currency: "INR", receipt: input.receipt } : null;
    },
    saveAttempt: async (value) => { calls.push(["save", value.providerOrderId, value.status]); },
  });
  return { calls, attempt, service };
}

test("creates and attaches a Razorpay order from the persisted amount", async () => {
  const { calls, attempt, service } = fixture();
  const result = await service({ attemptId, buyerId });
  assert.deepEqual(result, { providerOrderId: "order_test123", replayed: false });
  assert.equal(attempt.status, "pending");
  assert.equal(attempt.providerOrderId, "order_test123");
  const createCall = calls.find(([type]) => type === "create");
  assert.equal(createCall[1].amountPaise, 1250);
  assert.equal(createCall[1].receipt, `rb-${attemptId}`);
});

test("recovers a gateway order after an ambiguous create failure", async () => {
  const { service } = fixture({ gatewayError: new Error("temporary response loss") });
  assert.deepEqual(await service({ attemptId, buyerId }), { providerOrderId: "order_recovered", replayed: false });
});

test("returns an existing provider order without making another gateway request", async () => {
  const { calls, service } = fixture({ existingProviderOrderId: "order_test123", status: "pending" });
  assert.deepEqual(await service({ attemptId, buyerId }), { providerOrderId: "order_test123", replayed: true });
  assert.equal(calls.some(([type]) => type === "create" || type === "lookup"), false);
});

test("does not create a provider order for a mismatched local order amount", async () => {
  const { calls, service } = fixture();
  const readOrder = async () => ({ _id: localOrderId, buyerId, status: "pending_payment", amountPaise: 999, currency: "INR" });
  const guarded = createRazorpayOrderService({
    findAttemptById: async () => ({ _id: attemptId, orderId: localOrderId, provider: "razorpay", amountPaise: 1250, currency: "INR", status: "created" }),
    findOrderById: readOrder,
    createProviderOrder: async () => { calls.push(["create"]); },
    findProviderOrderByReceipt: async () => null,
    saveAttempt: async () => {},
  });
  await assert.rejects(guarded({ attemptId, buyerId }), { code: "INVALID_RAZORPAY_ORDER" });
  assert.equal(calls.some(([type]) => type === "create"), false);
});

test("does not expose payment attempts from another provider", async () => {
  const service = createRazorpayOrderService({
    findAttemptById: async () => ({ provider: "other", orderId: localOrderId }),
    findOrderById: async () => null,
    createProviderOrder: async () => null,
    findProviderOrderByReceipt: async () => null,
    saveAttempt: async () => {},
  });
  await assert.rejects(service({ attemptId, buyerId }), { code: "PAYMENT_ATTEMPT_NOT_FOUND" });
});

test("does not create a gateway order for a reader who does not own the order", async () => {
  const { calls } = fixture();
  const guarded = createRazorpayOrderService({
    findAttemptById: async () => ({
      _id: attemptId, orderId: localOrderId, provider: "razorpay", amountPaise: 1250, currency: "INR", status: "created",
    }),
    findOrderById: async () => ({
      _id: localOrderId, buyerId: "507f1f77bcf86cd799439014", status: "pending_payment", amountPaise: 1250, currency: "INR",
    }),
    createProviderOrder: async () => { calls.push(["create"]); },
    findProviderOrderByReceipt: async () => null,
    saveAttempt: async () => {},
  });
  await assert.rejects(guarded({ attemptId, buyerId }), { code: "PAYMENT_ORDER_NOT_FOUND" });
  assert.equal(calls.some(([type]) => type === "create"), false);
});
