import assert from "node:assert/strict";
import test from "node:test";
import { createPaymentEventProcessor } from "./payment-event-processor.js";

const persistedEventId = "507f1f77bcf86cd799439011";
const orderId = "507f1f77bcf86cd799439012";
const input = { rawBody: Buffer.from("{\"event\":\"signed\"}"), headers: { "x-signature": "signature" } };

function fixture({ recorded = {}, application = { applied: true, replayed: false }, applicationError, ledgerError } = {}) {
  const calls = [];
  const transactionSession = { inTransaction: () => true };
  const event = Object.hasOwn(recorded, "event") ? recorded.event : {
    _id: persistedEventId,
    eventType: "payment.captured",
    outcome: "applied",
    amountPaise: 4900,
    orderId,
  };
  const processor = createPaymentEventProcessor({
    recordEvent: async (request) => {
      calls.push(["record", request]);
      return { event, replayed: recorded.replayed === true };
    },
    withTransaction: async (callback) => {
      calls.push(["transaction"]);
      return callback(transactionSession);
    },
    postLedger: async (payload, options) => {
      calls.push(["ledger", payload, options]);
      if (ledgerError) throw ledgerError;
    },
    grantEntitlement: async (id, options) => {
      calls.push(["grant", id, options]);
    },
    queueDuplicateRefund: async (eventId, options) => {
      calls.push(["queue-refund", eventId, options]);
      return { replayed: false };
    },
    applyCapturedPayment: async (eventId, options) => {
      calls.push(["apply", eventId, options]);
      if (applicationError) throw applicationError;
      return application;
    },
  });
  return { calls, processor, transactionSession };
}

test("records a verified capture, then applies it inside a transaction", async () => {
  const data = fixture();
  const result = await data.processor(input);
  assert.deepEqual(result, {
    recorded: true,
    replayed: false,
    paymentApplied: true,
    applicationReplayed: false,
  });
  assert.deepEqual(data.calls.map(([name]) => name), ["record", "transaction", "apply", "ledger", "grant"]);
  assert.deepEqual(data.calls[4], ["grant", orderId, { session: data.transactionSession }]);
  assert.equal(data.calls[3][2].session, data.transactionSession);
  assert.equal(data.calls[3][1].paymentEventId, persistedEventId);
  assert.equal(data.calls[3][1].paymentEventId, persistedEventId);
  assert.equal(data.calls[0][1].rawBody, input.rawBody);
  assert.equal(data.calls[2][2].session.inTransaction(), true);
  assert.equal(data.calls[2][2].session, data.transactionSession);
});

test("does not open a transaction for ignored events", async () => {
  const data = fixture({
    recorded: {
      event: { _id: persistedEventId, eventType: "payment.failed", outcome: "ignored" },
      replayed: true,
    },
  });
  assert.deepEqual(await data.processor(input), {
    recorded: true,
    replayed: true,
    paymentApplied: false,
  });
  assert.deepEqual(data.calls.map(([name]) => name), ["record"]);
});

ort assert from "node:assert/strict";
import test from "node:test";
import { createPaymentEventProcessor } from "./payment-event-processor.js";

const persistedEventId = "507f1f77bcf86cd799439011";
const orderId = "507f1f77bcf86cd799439012";
const input = { rawBody: Buffer.from("{\"event\":\"signed\"}"), headers: { "x-signature": "signature" } };

function fixture({ recorded = {}, application = { applied: true, replayed: false }, applicationError, ledgerError } = {}) {
  const calls = [];
  const transactionSession = { inTransaction: () => true };
  const event = Object.hasOwn(recorded, "event") ? recorded.event : {
    _id: persistedEventId,
    eventType: "payment.captured",
    outcome: "applied",
    amountPaise: 4900,
    orderId,
  };
  const processor = createPaymentEventProcessor({
    recordEvent: async (request) => {
      calls.push(["record", request]);
      return { event, replayed: recorded.replayed === true };
    },
    withTransaction: async (callback) => {
      calls.push(["transaction"]);
      return callback(transactionSession);
    },
    postLedger: async (payload, options) => {
      calls.push(["ledger", payload, options]);
      if (ledgerError) throw ledgerError;
    },
    grantEntitlement: async (id, options) => {
      calls.push(["grant", id, options]);
    },
    queueDuplicateRefund: async (eventId, options) => {
      calls.push(["queue-refund", eventId, options]);
      return { replayed: false };
    },
    applyCapturedPayment: async (eventId, options) => {
      calls.push(["apply", eventId, options]);
      if (applicationError) throw applicationError;
      return application;
    },
  });
  return { calls, processor, transactionSession };
}

test("records a verified capture, then applies it inside a transaction", async () => {
  const data = fixture();
  const result = await data.processor(input);
  assert.deepEqual(result, {
    recorded: true,
    replayed: false,
    paymentApplied: true,
    applicationReplayed: false,
  });
  assert.deepEqual(data.calls.map(([name]) => name), ["record", "transaction", "apply", "ledger", "grant"]);
  assert.deepEqual(data.calls[4], ["grant", orderId, { session: data.transactionSession }]);
  assert.equal(data.calls[3][2].session, data.transactionSession);
  assert.equal(data.calls[3][1].paymentEventId, persistedEventId);
  assert.equal(data.calls[3][1].paymentEventId, persistedEventId);
  assert.equal(data.calls[0][1].rawBody, input.rawBody);
  assert.equal(data.calls[2][2].session.inTransaction(), true);
  assert.equal(data.calls[2][2].session, data.transactionSession);
});

test("does not open a transaction for ignored events", async () => {
  const data = fixture({
    recorded: {
      event: { _id: persistedEventId, eventType: "payment.failed", outcome: "ignored" },
      replayed: true,
    },
  });
  assert.deepEqual(await data.processor(input), {
    recorded: true,
    replayed: true,
    paymentApplied: false,
  });
  assert.deepEqual(data.calls.map(([name]) => name), ["record"]);
});

test("propagates capture-application failures after the immutable event is recorded", async () => {
  const data = fixture({ applicationError: new Error("transaction failed") });
  await assert.rejects(data.processor(input), /transaction failed/);
  assert.deepEqual(data.calls.map(([name]) => name), ["record", "transaction", "apply", "queue-refund"]);
  assert.equal(data.calls[3][1], persistedEventId);
  assert.equal(data.calls[3][2].session, data.transactionSession);
});

test("rejects a recorder result that is not a persisted event", async (t) => {
  for (const event of [null, {}, { _id: "bad-id", eventType: "payment.captured", outcome: "applied" }]) {
    await t.test(String(event?._id || "missing"), async () => {
      const data = fixture({ recorded: { event } });
      await assert.rejects(data.processor(input), { code: "PAYMENT_EVENT_NOT_PERSISTED" });
      assert.deepEqual(data.calls.map(([name]) => name), ["record"]);
    });
  }
});

test("surfaces matching duplicate event and application replays", async () => {
  const data = fixture({
    recorded: { replayed: true },
    application: { applied: true, replayed: true },
  });
  assert.deepEqual(await data.processor(input), {
    recorded: true,
    replayed: true,
    paymentApplied: true,
    applicationReplayed: true,
  });
  assert.equal(data.calls.some(([name]) => name === "ledger" || name === "grant"), false);
});

test("a ledger failure rejects the capture transaction", async () => {
  const data = fixture({ ledgerError: new Error("ledger unavailable") });
  await assert.rejects(data.processor(input), /ledger unavailable/);
  assert.equal(data.calls.at(-1)[0], "ledger");
});


test("does not duplicate ledger or access when a second capture is queued for refund", async () => {
  const data = fixture({
    application: {
      applied: false,
      replayed: false,
      duplicatePayment: true,
      refundAmountPaise: 4900,
    },
  });
  assert.deepEqual(await data.processor(input), {
    recorded: true,
    replayed: false,
    paymentApplied: false,
    applicationReplayed: false,
    duplicatePayment: true,
    refundStatus: "pending",
  });
  assert.deepEqual(data.calls.map(([name]) => name), ["record", "transaction", "apply", "queue-refund"]);
});
