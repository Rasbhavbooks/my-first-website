import assert from "node:assert/strict";
import test from "node:test";
import { createLedgerWriter } from "./ledger-writer.js";

const paymentEvent = {
  provider: "example-pay",
  eventId: "evt_123",
  orderId: "order-123",
  amountPaise: 12500,
  currency: "INR",
  signatureVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
  outcome: "applied",
};

const entries = [
  { accountCode: "gateway.clearing", direction: "debit", amountPaise: 12500 },
  { accountCode: "sales.receivable", direction: "credit", amountPaise: 12500 },
];

function makeStore() {
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
  };
}

test("posts a verified event with a hashed source key", async () => {
  const store = makeStore();
  const writer = createLedgerWriter({ createRecord: store.create, findBySourceKeyHash: store.find });
  const result = await writer({ paymentEvent, entries });

  assert.equal(result.replayed, false);
  assert.match(result.transaction.sourceKeyHash, /^[a-f0-9]{64}$/);
  assert.equal(result.transaction.sourceId, "example-pay:evt_123");
  assert.equal(store.createCount, 1);
});

test("returns the existing posting for an identical retry without creating another", async () => {
  const store = makeStore();
  const writer = createLedgerWriter({ createRecord: store.create, findBySourceKeyHash: store.find });
  const first = await writer({ paymentEvent, entries });
  const retry = await writer({ paymentEvent, entries: [...entries].reverse() });

  assert.equal(retry.replayed, true);
  assert.equal(retry.transaction, first.transaction);
  assert.equal(store.createCount, 1);
});

test("rejects reuse of a verified event with different ledger amounts", async () => {
  const store = makeStore();
  const writer = createLedgerWriter({ createRecord: store.create, findBySourceKeyHash: store.find });
  await writer({ paymentEvent, entries });

  await assert.rejects(
    writer({
      paymentEvent,
      entries: [
        { accountCode: "gateway.clearing", direction: "debit", amountPaise: 12000 },
        { accountCode: "sales.receivable", direction: "credit", amountPaise: 12000 },
      ],
    }),
    { code: "INVALID_LEDGER_INPUT" },
  );
  assert.equal(store.createCount, 1);
});

test("fails closed for unverified or ignored events", async () => {
  const store = makeStore();
  const writer = createLedgerWriter({ createRecord: store.create, findBySourceKeyHash: store.find });
  await assert.rejects(writer({ paymentEvent: { ...paymentEvent, signatureVerifiedAt: null }, entries }), /signature-verified/);
  await assert.rejects(writer({ paymentEvent: { ...paymentEvent, outcome: "ignored" }, entries }), /Only applied/);
  assert.equal(store.createCount, 0);
});

test("rejects balanced entries that do not equal the verified payment amount", async () => {
  const store = makeStore();
  const writer = createLedgerWriter({ createRecord: store.create, findBySourceKeyHash: store.find });
  await assert.rejects(
    writer({
      paymentEvent,
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
  const payloads = [];
  const createRecord = async (payload) => {
    payloads.push(payload);
    const duplicate = new Error("duplicate key");
    duplicate.code = 11000;
    throw duplicate;
  };
  const findBySourceKeyHash = async () => existing;
  const writer = createLedgerWriter({ createRecord, findBySourceKeyHash });
  const pending = writer({ paymentEvent, entries });
  await Promise.resolve();
  existing = {
    ...payloads[0],
  };
  const result = await pending;

  assert.equal(result.replayed, true);
  assert.equal(result.transaction, existing);
});
