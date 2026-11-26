import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import RefundRequest from "./refund-request.model.js";

function validRequest(overrides = {}) {
  return new RefundRequest({
    orderId: new mongoose.Types.ObjectId(),
    paymentAttemptId: new mongoose.Types.ObjectId(),
    sourcePaymentEventId: new mongoose.Types.ObjectId(),
    provider: "razorpay",
    providerPaymentId: "pay_duplicate",
    reason: "duplicate_payment",
    amountPaise: 13929,
    currency: "INR",
    ...overrides,
  });
}

test("refund request snapshots a private provider payment and positive whole-paise amount", async () => {
  const request = validRequest();
  await request.validate();
  assert.equal(request.status, "pending");
  assert.equal(request.reason, "duplicate_payment");
  assert.equal(request.providerPaymentId, "pay_duplicate");
});

test("refund request rejects fractional money and unknown reason", async () => {
  await assert.rejects(validRequest({ amountPaise: 139.29 }).validate(), /whole paise/);
  await assert.rejects(validRequest({ reason: "anything" }).validate());
});

test("refund request permits only guarded lifecycle transitions", async () => {
  const request = validRequest();\n  request.$isNew = false;\n  request.$locals.persistedStatus = "pending";
  request.transitionTo("submitted");
  await request.validate();
  assert.equal(request.status, "submitted");
  assert.throws(() => request.transitionTo("completed", { providerRefundId: "rfnd_test123" }), {
    code: "INVALID_REFUND_TRANSITION",
  });
});
