import assert from "node:assert/strict";
import test from "node:test";
import { createCapturedPaymentApplicationService } from "./payment-application.service.js";

const id = "507f1f77bcf86cd799439011";
const now = new Date("2026-11-25T10:00:00.000Z");

function fixture(overrides = {}) {
  const calls = [];
  const event = {
    _id: id,
    orderId: "order-1",
    provider: "example-gateway",
    eventId: "evt-1",
    eventType: "payment.captured",
    providerPaymentId: "pay-1",
    amountPaise: 4900,
    currency: "INR",
    signatureVerifiedAt: now,
    outcome: "applied",
    ...overrides.event,
  };
  const order = {
    _id: "order-1",
    status: "pending_payment",
    amountPaise: 4900,
    currency: "INR",
    paymentProvider: "",
    paymentReference: "",
    transitionTo(status, options) {
      calls.push(["order-transition", status, options]);
      this.status = status;
      this.paymentProvider = options.paymentProvider;
      this.paymentReference = options.paymentReference;
    },
    async save(options) { calls.push(["order-save", options]); },
    ...overrides.order,
  };
  const attempt = {
    orderId: "order-1",
    provider: "example-gateway",
    providerPaymentId: "pay-1",
    amountPaise: 4900,
    currency: "INR",
    status: "authorized",
    transitionTo(status, time) {
      calls.push(["attempt-transition", status, time]);
      this.status = status;
    },
    async save(options) { calls.push(["attempt-save", options]); },
    ...overrides.attempt,
  };
  const session = { inTransaction: () => true };
  const service = createCapturedPaymentApplicationService({
    findPaymentEventById: async (eventId, options) => {
      calls.push(["event-lookup", eventId, options]);
      return event;
    },
    findOrderById: async (orderId, options) => {
      calls.push(["order-lookup", orderId, options]);
      return order;
    },
    findAttemptByProviderPaymentId: async (provider, paymentId, options) => {
      calls.push(["attempt-lookup", provider, paymentId, options]);
      return attempt;
    },
  });
  return { calls, event, order, attempt, session, service };
}

test("applies a verified capture to its matching attempt and one-book order in the supplied transaction", async () => {
  const data = fixture();
  const result = await data.service(id, { session: data.session, now });
  assert.deepEqual(result, { applied: true, replayed: false });
  assert.equal(data.attempt.status, "captured");
  assert.equal(data.order.status, "paid");
  assert.equal(data.order.paymentProvider, "example-gateway");
  assert.equal(data.order.paymentReference, "pay-1");
  assert.deepEqual(data.calls.filter(([name]) => name.endsWith("-save")).map(([name]) => name), [
    "attempt-save",
    "order-save",
  ]);
  assert.ok(data.calls.filter(([name]) => name.endsWith("-save")).every(([, options]) => options.session === data.session));
});

test("requires an active transaction and a persisted event identifier", async () => {
  const data = fixture();
  await assert.rejects(data.service(id), { code: "TRANSACTION_REQUIRED" });
  await assert.rejects(data.service("not-an-id", { session: data.session }), { code: "INVALID_PAYMENT_EVENT_ID" });
});

test("rejects ignored, unsigned, wrong-type, or malformed verified events", async (t) => {
  const cases = [
    ["ignored", { outcome: "ignored" }],
    ["unsigned", { signatureVerifiedAt: null }],
    ["not captured", { eventType: "payment.authorized" }],
    ["invalid amount", { amountPaise: 49.5 }],
  ];
  for (const [label, event] of cases) {
    await t.test(label, async () => {
      const data = fixture({ event });
      await assert.rejects(data.service(id, { session: data.session }));
      assert.equal(data.calls.some(([name]) => name === "attempt-transition"), false);
    });
  }
});

test("rejects amount, order, or provider payment mismatches without changing records", async (t) => {
  const cases = [
    ["order amount", { order: { amountPaise: 5000 } }],
    ["attempt order", { attempt: { orderId: "different-order" } }],
    ["attempt payment ID", { attempt: { providerPaymentId: "other-payment" } }],
  ];
  for (const [label, overrides] of cases) {
    await t.test(label, async () => {
      const data = fixture(overrides);
      await assert.rejects(data.service(id, { session: data.session }));
      assert.equal(data.calls.some(([name]) => name === "attempt-transition"), false);
    });
  }
});

test("returns an idempotent replay for the same already-paid capture", async () => {
  const data = fixture({
    order: { status: "paid", paymentProvider: "example-gateway", paymentReference: "pay-1" },
    attempt: { status: "captured" },
  });
  assert.deepEqual(await data.service(id, { session: data.session }), { applied: true, replayed: true });
  assert.equal(data.calls.some(([name]) => name.endsWith("-save")), false);
});

test("rejects a paid order linked to another payment and never calls ledger or access services", async () => {
  const data = fixture({
    order: { status: "paid", paymentProvider: "example-gateway", paymentReference: "different-payment" },
    attempt: { status: "captured" },
  });
  await assert.rejects(data.service(id, { session: data.session }));
  assert.equal(data.calls.some(([name]) => name.includes("ledger") || name.includes("entitlement")), false);
});
