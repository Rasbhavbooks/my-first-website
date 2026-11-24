import assert from "node:assert/strict";
import test from "node:test";
import {
  paymentEventSourceKeyHash,
  serializeReconciliationEvent,
} from "./admin-payment-reconciliation.controller.js";

const baseEvent = {
  _id: "payment-event-internal-id",
  provider: "test-gateway",
  eventId: "private-provider-event-id",
  eventType: "payment.captured",
  orderId: "order-internal-id",
  amountPaise: 12500,
  currency: "INR",
  outcome: "applied",
  signatureVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
  processedAt: new Date("2026-01-01T00:00:01.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  providerPaymentId: "private-provider-payment-reference",
};

test("reconciliation classifies a matching ledger post without exposing provider identifiers", () => {
  const hash = paymentEventSourceKeyHash(baseEvent.provider, baseEvent.eventId);
  const result = serializeReconciliationEvent(baseEvent, new Set([hash]));

  assert.equal(result.status, "posted");
  assert.equal(result.orderId, "order-internal-id");
  assert.equal("provider" in result, false);
  assert.equal("eventId" in result, false);
  assert.equal("providerPaymentId" in result, false);
  assert.equal("sourceKeyHash" in result, false);
});

test("applied event without a ledger transaction is marked unposted", () => {
  assert.equal(serializeReconciliationEvent(baseEvent).status, "unposted");
});

test("ignored event without a ledger transaction remains ignored", () => {
  assert.equal(serializeReconciliationEvent({ ...baseEvent, outcome: "ignored" }).status, "ignored");
});
