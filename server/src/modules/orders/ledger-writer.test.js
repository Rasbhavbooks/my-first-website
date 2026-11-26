import assert from "node:assert/strict";
import test from "node:test";
import { createLedgerWriter } from "./ledger-writer.js";

const paymentEvent = {
  _id: "64c0ffee0000000000000001",
  provider: "example-pay",
  eventId: "evt_123",
  orderId: "64c0ffee0000000000000002",
  amountPaise: 13929,
  currency: "INR",
  signatureVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
  outcome: "applied",
};
const orderSnapshot = {
  _id: paymentEvent.orderId,
  status: "paid",
  amountPaise: 13929,
  currency: "INR",
  authorPricePaise: 10000,
  platformCommissionPaise: 3000,
  referrerRewardPaise: 0,
  gstPaise: 650,
  gatewayFeePaise: 279,
};

function makeStore(event = paymentEvent, order = orderSnapshot) {
  const records = new Map();
  let createCount = 0;
  return {
    records,
    get createCount() { return createCount; },
    create: async (payload) => {
      createCount += 1;
      if (records.has(payload.sourceKeyHash)) {
        const error = new Error("duplicate key");
        error.code = 11000;
        throw error;
      }
      const record = { ...payload };
      records.set(payload.sourceKeyHash, record);
      return record;
    },
    find: async (hash) => records.get(hash) ?? null,
    findEvent: async (id) => id === event?._id ? event : null,
    findOrder: async (id) => String(id) === String(order?._id) ? order : null,
  };
}

function makeWriter(store) {
  return createLedgerWriter({
    createRecord: store.create,
    findBySourceKeyHash: store.find,
    findPaymentEventById: store.findEvent,
    findOrderById: store.findOrder,
  });
}
const postInput = { paymentEventId: paymentEvent._id };

test("posts itemized allocation from the persisted order snapshot", async () => {
  const store = makeStore();
  const result = await makeWriter(store)(postInput);
  assert.equal(result.replayed, false);
  assert.equal(result.transaction.eventType, "order_payment");
  assert.equal(result.transaction.sourceId, "example-pay:evt_123");
  assert.equal(String(result.transaction.orderId), paymentEvent.orderId);
  assert.equal(store.createCount, 1);
  const allocation = Object.fromEntries(result.transaction.entries
    .filter((entry) => entry.direction === "credit")
    .map((entry) => [entry.accountCode, entry.amountPaise]));
  assert.deepEqual(allocation, {
    author_payable: 10000,
    gateway_fee_payable: 279,
    platform_commission: 3000,
    tax_payable: 650,
  });
  assert.equal(result.transaction.entries.find((entry) => entry.direction === "debit").amountPaise, 13929);
});

test("ignores caller-supplied ledger allocations and payment fields", async () => {
  const store = makeStore();
  const result = await makeWriter(store)({
    ...postInput,
    entries: [{ accountCode: "attacker", direction: "credit", amountPaise: 1 }],
    paymentEvent: { ...paymentEvent, amountPaise: 1, orderId: "64c0ffee0000000000000003" },
  });
  assert.equal(result.transaction.entries.some((entry) => entry.accountCode === "attacker"), false);
  assert.equal(result.transaction.entries.find((entry) => entry.accountCode === "author_payable").amountPaise, 10000);
});

test("returns an existing posting for an identical retry", async () => {
  const store = makeStore();
  const writer = makeWriter(store);
  const first = await writer(postInput);
  const retry = await writer(postInput);
  assert.equal(retry.replayed, true);
  assert.equal(retry.transaction, first.transaction);
  assert.equal(store.createCount, 1);
});

test("fails closed for missing, unverified, or ignored persisted events", async () => {
  const store = makeStore();
  const writer = makeWriter(store);
  await assert.rejects(writer({ paymentEventId: "000000000000000000000099" }), { code: "PAYMENT_EVENT_NOT_FOUND" });
  await assert.rejects(makeWriter(makeStore({ ...paymentEvent, signatureVerifiedAt: null }))(postInput), /signature-verified/);
  await assert.rejects(makeWriter(makeStore({ ...paymentEvent, outcome: "ignored" }))(postInput), /Only applied/);
  assert.equal(store.createCount, 0);
});

test("requires a paid matching INR order with complete allocation", async () => {
  await assert.rejects(makeWriter(makeStore(paymentEvent, { ...orderSnapshot, status: "pending_payment" }))(postInput), /Only paid orders/);
  await assert.rejects(makeWriter(makeStore(paymentEvent, { ...orderSnapshot, amountPaise: 12000 }))(postInput), /must match the paid order/);
  await assert.rejects(makeWriter(makeStore(paymentEvent, { ...orderSnapshot, currency: "USD" }))(postInput), /must match the paid order/);
  await assert.rejects(makeWriter(makeStore(paymentEvent, { ...orderSnapshot, gatewayFeePaise: undefined }))(postInput), /missing its immutable pricing allocation/);
});
