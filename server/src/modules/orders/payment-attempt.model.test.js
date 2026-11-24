import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import DigitalBookPaymentAttempt from "./payment-attempt.model.js";

function validAttempt(overrides = {}) {
  return new DigitalBookPaymentAttempt({
    orderId: new mongoose.Types.ObjectId(),
    attemptNumber: 1,
    idempotencyKeyHash: "c".repeat(64),
    provider: "example-gateway",
    amountPaise: 4900,
    ...overrides,
  });
}

test("payment attempt starts as created and follows a valid capture path", async () => {
  const attempt = validAttempt();
  await attempt.validate();
  assert.equal(attempt.status, "created");

  const capturedAt = new Date("2026-11-24T12:00:00.000Z");
  attempt.transitionTo("pending");
  attempt.transitionTo("authorized");
  attempt.transitionTo("captured", capturedAt);
  await attempt.validate();

  assert.equal(attempt.status, "captured");
  assert.equal(attempt.capturedAt.toISOString(), capturedAt.toISOString());
});

test("payment attempt records valid refund and retry path", () => {
  const attempt = validAttempt({ status: "captured" });
  attempt.transitionTo("refund_pending");
  attempt.transitionTo("captured");
  attempt.transitionTo("refund_pending");
  attempt.transitionTo("refunded");

  assert.equal(attempt.status, "refunded");
  assert.ok(attempt.refundedAt instanceof Date);
});

test("payment attempt rejects skipped transitions and terminal-state changes", () => {
  const attempt = validAttempt();
  assert.throws(() => attempt.transitionTo("refunded"), { code: "INVALID_PAYMENT_TRANSITION" });
  attempt.transitionTo("failed");
  assert.throws(() => attempt.transitionTo("pending"), { code: "INVALID_PAYMENT_TRANSITION" });
});

test("payment attempt validates whole-paise amounts and provider identifiers", async () => {
  await assert.rejects(validAttempt({ amountPaise: 49.5 }).validate(), /whole paise/);
  await assert.rejects(validAttempt({ provider: "Example Gateway" }).validate());
  await assert.rejects(validAttempt({ currency: "USD" }).validate());
});

test("payment model refuses raw payment credential fields", () => {
  assert.throws(
    () => validAttempt({ cardNumber: "4111111111111111" }),
    /cardNumber/,
  );
  assert.equal(DigitalBookPaymentAttempt.schema.path("providerPaymentId").options.select, false);
  assert.equal(DigitalBookPaymentAttempt.schema.path("idempotencyKeyHash").options.select, false);
});
