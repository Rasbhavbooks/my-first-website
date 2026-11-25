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

function persistedAttempt(status) {
  const data = validAttempt().toObject();
  return DigitalBookPaymentAttempt.hydrate({ ...data, status });
}

test("payment attempt follows valid state transitions one persisted step at a time", async () => {
  const attempt = validAttempt();
  await attempt.validate();
  assert.equal(attempt.status, "created");

  const pending = new Date("2026-11-24T12:00:00.000Z");
  attempt.transitionTo("pending", pending);
  await attempt.validate();
  assert.equal(attempt.status, "pending");

  const authorized = persistedAttempt("pending");
  authorized.transitionTo("authorized");
  await authorized.validate();

  const captured = persistedAttempt("authorized");
  const capturedAt = new Date("2026-11-24T12:01:00.000Z");
  captured.transitionTo("captured", capturedAt);
  await captured.validate();
  assert.equal(captured.status, "captured");
  assert.equal(captured.capturedAt.toISOString(), capturedAt.toISOString());
});

test("payment attempt follows refund transitions only after each prior state is persisted", () => {
  const refundPending = persistedAttempt("captured");
  refundPending.transitionTo("refund_pending");
  assert.equal(refundPending.status, "refund_pending");

  const capturedAgain = persistedAttempt("refund_pending");
  capturedAgain.transitionTo("captured");
  assert.equal(capturedAgain.status, "captured");

  const retryRefund = persistedAttempt("captured");
  retryRefund.transitionTo("refund_pending");
  const refunded = persistedAttempt("refund_pending");
  refunded.transitionTo("refunded");
  assert.equal(refunded.status, "refunded");
  assert.ok(refunded.refundedAt instanceof Date);
});

test("payment attempt rejects skipped transitions, direct status edits, and unsaved chained transitions", async () => {
  const attempt = validAttempt();
  assert.throws(() => attempt.transitionTo("refunded"), { code: "INVALID_PAYMENT_TRANSITION" });

  const edited = persistedAttempt("created");
  edited.status = "captured";
  await assert.rejects(edited.validate(), /Use transitionTo\(\)/);

  const chained = validAttempt();
  chained.transitionTo("pending");
  assert.throws(() => chained.transitionTo("captured"), { code: "INVALID_PAYMENT_TRANSITION" });

  await assert.rejects(validAttempt({ status: "captured" }).validate(), /New payment attempts must start as created/);
});

test("payment attempt refuses query-based updates that bypass transition validation", async () => {
  const id = new mongoose.Types.ObjectId();
  await assert.rejects(
    DigitalBookPaymentAttempt.updateOne({ _id: id }, { $set: { status: "captured" } }).exec(),
    { code: "INVALID_PAYMENT_TRANSITION" },
  );
  await assert.rejects(
    DigitalBookPaymentAttempt.findOneAndUpdate({ _id: id }, { status: "refunded" }).exec(),
    { code: "INVALID_PAYMENT_TRANSITION" },
  );
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

test("attaches a private provider order reference through the validated method", async () => {
  const attempt = persistedAttempt("created");
  attempt.attachProviderOrderId("order_test123");
  await attempt.validate();
  assert.equal(attempt.providerOrderId, "order_test123");
});

test("rejects direct changes to a persisted provider order reference", async () => {
  const attempt = persistedAttempt("created");
  attempt.providerOrderId = "order_unchecked123";
  await assert.rejects(attempt.validate(), (error) => {
    assert.ok(error.errors.providerOrderId);
    return true;
  });
});

test("does not allow replacing a provider order once attached", () => {
  const attempt = persistedAttempt("created");
  attempt.providerOrderId = "order_test123";
  assert.throws(() => attempt.attachProviderOrderId("order_other123"), {
    code: "INVALID_PAYMENT_TRANSITION",
  });
});
