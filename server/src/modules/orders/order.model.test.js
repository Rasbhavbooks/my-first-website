import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import DigitalBookOrder from "./order.model.js";
import DigitalBookPaymentEvent from "./payment-event.model.js";

const title = { en: "Quiet River", gu: "શાંત નદી", hi: "शांत नदी" };

function validOrder(overrides = {}) {
  return new DigitalBookOrder({
    buyerId: new mongoose.Types.ObjectId(),
    idempotencyKeyHash: "a".repeat(64),
    bookId: "quiet-river",
    bookTitle: title,
    authorName: "A. Writer",
    amountPaise: 12500,
    ...overrides,
  });
}

test("digital book orders snapshot one INR book price and begin pending payment", async () => {
  const order = validOrder();
  await order.validate();

  assert.equal(order.currency, "INR");
  assert.equal(order.status, "pending_payment");
  assert.equal(order.amountPaise, 12500);
  assert.equal(order.paymentProvider, "");
  assert.equal(order.paymentReference, "");
});

function persistedOrder(status, overrides = {}) {
  const data = validOrder().toObject();
  return DigitalBookOrder.hydrate({ ...data, status, ...overrides });
}

test("paid order transition requires a private provider reference and saves a timestamp", async () => {
  const order = persistedOrder("pending_payment");
  const paidAt = new Date("2026-11-24T12:00:00.000Z");
  assert.throws(() => order.transitionTo("paid"), { code: "INVALID_ORDER_TRANSITION" });

  order.transitionTo("paid", {
    now: paidAt,
    paymentProvider: "example-gateway",
    paymentReference: "private-payment-123",
  });
  await order.validate();
  assert.equal(order.status, "paid");
  assert.equal(order.paymentProvider, "example-gateway");
  assert.equal(order.paymentReference, "private-payment-123");
  assert.equal(order.paidAt.toISOString(), paidAt.toISOString());
});

test("order status and payment lifecycle fields cannot be edited directly", async () => {
  const order = persistedOrder("pending_payment");
  order.status = "paid";
  await assert.rejects(order.validate(), /Use transitionTo\(\)/);

  const paymentMetadata = persistedOrder("pending_payment");
  paymentMetadata.paymentProvider = "example-gateway";
  paymentMetadata.paymentReference = "private-payment-123";
  paymentMetadata.paidAt = new Date();
  await assert.rejects(paymentMetadata.validate(), /payment metadata and lifecycle timestamps/);

  const paid = persistedOrder("paid");
  paid.refundedAt = new Date();
  await assert.rejects(paid.validate(), /payment metadata and lifecycle timestamps/);
});

test("orders reject query updates that bypass lifecycle validation", async () => {
  const id = new mongoose.Types.ObjectId();
  await assert.rejects(
    DigitalBookOrder.updateOne({ _id: id }, { $set: { status: "paid" } }).exec(),
    { code: "INVALID_ORDER_TRANSITION" },
  );
  await assert.rejects(
    DigitalBookOrder.findOneAndUpdate({ _id: id }, { status: "refunded" }).exec(),
    { code: "INVALID_ORDER_TRANSITION" },
  );
});

test("orders cancel and refund only through permitted lifecycle transitions", async () => {
  const cancelled = persistedOrder("pending_payment");
  const cancelledAt = new Date("2026-11-24T12:30:00.000Z");
  cancelled.transitionTo("cancelled", { now: cancelledAt });
  await cancelled.validate();
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.cancelledAt.toISOString(), cancelledAt.toISOString());
  assert.throws(() => cancelled.transitionTo("pending_payment"), { code: "INVALID_ORDER_TRANSITION" });

  const refundPending = persistedOrder("paid");
  refundPending.transitionTo("refund_pending");
  await refundPending.validate();

  const refunded = persistedOrder("refund_pending");
  const refundedAt = new Date("2026-11-24T13:00:00.000Z");
  refunded.transitionTo("refunded", { now: refundedAt });
  await refunded.validate();
  assert.equal(refunded.status, "refunded");
  assert.equal(refunded.refundedAt.toISOString(), refundedAt.toISOString());
});

test("new orders cannot start with a paid or cancelled status", async () => {
  await assert.rejects(validOrder({ status: "paid" }).validate(), /New orders must start as pending payment/);
  await assert.rejects(validOrder({ paymentProvider: "example-gateway" }).validate(), /without payment or lifecycle metadata/);
});

test("immutable order snapshots cannot be changed after creation", async () => {
  const order = persistedOrder("pending_payment");
  order.amountPaise = 1;
  order.bookId = "different-book";
  assert.equal(order.amountPaise, 12500);
  assert.equal(order.bookId, "quiet-river");
  for (const field of ["buyerId", "idempotencyKeyHash", "bookId", "bookTitle", "authorName", "amountPaise", "currency"]) {
    assert.equal(DigitalBookOrder.schema.path(field).options.immutable, true, field);
  }
});

test("digital book orders reject fractional paise and raw idempotency keys", async () => {
  await assert.rejects(validOrder({ amountPaise: 125.5 }).validate(), /whole paise/);
  await assert.rejects(validOrder({ idempotencyKeyHash: "raw-user-key" }).validate());
});

test("digital book orders reject non-INR currency and unknown states", async () => {
  await assert.rejects(validOrder({ currency: "USD" }).validate());
  await assert.rejects(validOrder({ status: "checkout_complete" }).validate());
});

test("payment event requires a verified signature timestamp and a valid INR amount", async () => {
  const event = new DigitalBookPaymentEvent({
    orderId: new mongoose.Types.ObjectId(),
    paymentAttemptId: new mongoose.Types.ObjectId(),
    providerOrderId: "order_test123",
    provider: "example-gateway",
    eventId: "event-123",
    eventType: "payment.captured",
    providerPaymentId: "payment-123",
    amountPaise: 12500,
    signatureVerifiedAt: new Date(),
    outcome: "applied",
  });
  await event.validate();
  assert.equal(event.currency, "INR");

  const unverifiedEvent = new DigitalBookPaymentEvent({
    orderId: new mongoose.Types.ObjectId(),
    paymentAttemptId: new mongoose.Types.ObjectId(),
    providerOrderId: "order_test123",
    provider: "example-gateway",
    eventId: "event-124",
    eventType: "payment.captured",
    amountPaise: 12500,
    outcome: "applied",
  });
  await assert.rejects(unverifiedEvent.validate());
});

test("payment events reject fractional amounts and invalid provider names", async () => {
  const event = new DigitalBookPaymentEvent({
    orderId: new mongoose.Types.ObjectId(),
    paymentAttemptId: new mongoose.Types.ObjectId(),
    providerOrderId: "order_test123",
    provider: "Example Gateway",
    eventId: "event-125",
    eventType: "payment.captured",
    amountPaise: 1.25,
    signatureVerifiedAt: new Date(),
    outcome: "applied",
  });
  await assert.rejects(event.validate());
});

test("verified payment facts are immutable and provider references stay private", () => {
  for (const path of [
    "orderId",
    "provider",
    "eventId",
    "eventType",
    "providerOrderId",
    "paymentAttemptId",
    "providerPaymentId",
    "amountPaise",
    "currency",
    "signatureVerifiedAt",
  ]) {
    assert.equal(DigitalBookPaymentEvent.schema.path(path).options.immutable, true, path);
  }
  assert.equal(DigitalBookPaymentEvent.schema.path("providerPaymentId").options.select, false);
  assert.notEqual(DigitalBookPaymentEvent.schema.path("outcome").options.immutable, true);
  assert.notEqual(DigitalBookPaymentEvent.schema.path("processedAt").options.immutable, true);
});
