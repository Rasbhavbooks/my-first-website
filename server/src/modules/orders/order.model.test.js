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
    provider: "Example Gateway",
    eventId: "event-125",
    eventType: "payment.captured",
    amountPaise: 1.25,
    signatureVerifiedAt: new Date(),
    outcome: "applied",
  });
  await assert.rejects(event.validate());
});
