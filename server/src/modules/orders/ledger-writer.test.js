import assert from "node:assert/strict";
import test from "node:test";
import { createLedgerWriter } from "./ledger-writer.js";

const paymentEvent = {
  _id: "64c0ffee0000000000000001",
  provider: "example-pay",
  eventId: "evt_123",
  orderId: "64c0ffee0000000000000002",
  amountPaise: 12500,
  currency: "INR",
  signatureVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
  outcome: "applied",
};

const entries = [
  { accountCode: "gateway.clearing", direction: "debit", amountPaise: 12500 },
  { accountCode: "sales.receivable", direction: "credit", amountPaise: 12500 },
];

function makeStore(event = paymentEvent) {
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
  };
}

function makeWriter(store) {
  return createLedgerWriter({
    createRecord: store.create,
    findBySourceKeyHash: store.find,
    findPaymentEventById: store.findEvent,
  });
}

const postInput = { paymentEventId: paymentEvent._id, entries };

test("posts a persisted verified event with a hashed source key", async () => {
  const store = makeStore();
  const result = await makeWriter(store)(postInput);

  assert.equal(result.replayed, false);
  assert.match(result.transaction.sourceKeyHash, /^[a-f0-9]{64}$/);
  assert.equal(result.transaction.sourceId, "example-pay:evt_123");
  assert.equal(String(result.transaction.orderId), paymentEvent.orderId);
  assert.equal(store.createCount, 1);
});

test("ignores caller-supplied payment fields and uses the stored amount and order", async () => {
  const store = makeStore();
  const result = await makeWriter(store)({
    ...postInput,
    paymentEvent: {
      ...paymentEvent,
      amountPaise: 1,
      orderId: "64c0ffee0000000000000003",
      signatureVerifiedAt: new Date(),
    },
  });

  assert.equal(result.transaction.entries[0].amountPaise, 12500);
  assert.equal(String(result.transaction.orderId), paymentEvent.orderId);
  assert.equal(store.createCount, 1);
});

test("returns the existing posting for an identical retry without creating another", async () => {
  const store = makeStore();
  const writer = makeWriter(store);
  const first = await writer(postInput);
  const retry = await writer({ ...postInput, entries: [...entries].reverse() });

  assert.equal(retry.replayed, true);
  assert.equal(retry.transaction, first.transaction);
  assert.equal(store.createCount, 1);
});

test("rejects reuse of a verified event with different ledger accounts", async () => {
  const store = makeStore();
  const writer = makeWriter(store);
  await writer(postInput);

  await assert.rejects(
    writer({
      ...postInput,
      entries: [
        { accountCode: "gateway.other", direction: "debit", amountPaise: 12500 },
        { accountCode: "sales.receivable", direction: "credit", amountPaise: 12500 },
      ],
    }),
    { code: "IDEMPOTENCY_KEY_REUSED" },
  );
  assert.equal(store.createCount, 1);
});

test("fails closed for missing, unverified, or ignored persisted events", async () => {
  const store = makeStore();
  const writer = makeWriter(store);
  await assert.rejects(writer({ ...postInput, paymentEventId: "000000000000000000000099" }), { code: "PAYMENT_EVENT_NOT_FOUND" });
  await assert.rejects(
    makeWriter(makeStore({ ...paymentEvent, signatureVerifiedAt: null }))(postInput),
    /signature-verified/,
  );
  await assert.rejects(
    makeWriter(makeStore({ ...paymentEvent, outcome: "ignored" }))(postInput),
    /Only applied/,
  );
  assert.equal(store.createCount, 0);
});

test("rejects balanced entries that do not equal the stored payment amount", async () => {
  const store = makeStore();
  await assert.rejects(
    makeWriter(store)({
      ...postInput,
      entries: [
        { accountCode: "gateway.clearing", direction: "debit", amountPaise: 10000 },
        { accountCode: "sales.receivable", direction: "credit", amountPaise: 10000 },
      ],
    }),
    /equal the verified payment amount/,
  );
  assert.equal(store.createCount, 0);
});

test("handles a concurrent duplicate-key insert as an idempotent replay", async () => {
  let existing;
  const createRecord = async (payload) => {
    existing = { ...payload };
    const duplicate = new Error("duplicate key");
    duplicate.code = 11000;
    throw duplicate;
  };
  const findBySourceKeyHash = async () => existing;
  const findPaymentEventById = async () => paymentEvent;
  const writer = createLedgerWriter({ createRecord, findBySourceKeyHash, findPaymentEventById });
  const result = await writer(postInput);

  assert.equal(result.replayed, true);
  assert.equal(result.transaction, existing);
});
