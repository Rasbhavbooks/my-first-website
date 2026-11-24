import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createPaidBookEntitlementService } from "./book-entitlement.service.js";

const ids = {
  order: "64b000000000000000000001",
  reader: "64b000000000000000000002",
  ledger: "64b000000000000000000003",
};
const order = {
  _id: ids.order,
  buyerId: ids.reader,
  bookId: "quiet-between",
  status: "paid",
  amountPaise: 12900,
  currency: "INR",
};
const paymentSourceId = "test-gateway:evt_1";
const paymentEvent = {
  provider: "test-gateway",
  eventId: "evt_1",
  orderId: ids.order,
  outcome: "applied",
  amountPaise: 12900,
  currency: "INR",
  signatureVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
};
const ledger = {
  _id: ids.ledger,
  orderId: ids.order,
  eventType: "order_payment",
  sourceType: "payment_event",
  sourceId: paymentSourceId,
  sourceKeyHash: createHash("sha256").update(paymentSourceId).digest("hex"),
  currency: "INR",
  entries: [
    { direction: "debit", amountPaise: 12900 },
    { direction: "credit", amountPaise: 12900 },
  ],
};

function makeService(overrides = {}) {
  const writes = [];
  const records = { order, ledger, paymentEvent, byOrder: null, byReaderBook: null };
  const service = createPaidBookEntitlementService({
    findOrderById: async () => records.order,
    findPaymentLedgerByOrderId: async () => records.ledger,
    findVerifiedPaymentEvent: async () => records.paymentEvent,
    findEntitlementByOrderId: async () => records.byOrder,
    findEntitlementByReaderAndBook: async () => records.byReaderBook,
    createEntitlement: async (record) => { writes.push(record); return { _id: "entitlement-1", ...record }; },
    ...overrides,
  });
  return { service, records, writes };
}

test("does not grant access for an unpaid order", async () => {
  const { service, records, writes } = makeService();
  records.order = { ...order, status: "pending_payment" };
  await assert.rejects(service(ids.order), { code: "ORDER_NOT_PAID" });
  assert.equal(writes.length, 0);
});

test("requires a matching balanced payment ledger entry", async () => {
  const { service, records, writes } = makeService();
  records.ledger = { ...ledger, entries: [{ direction: "debit", amountPaise: 12900 }, { direction: "credit", amountPaise: 12899 }] };
  await assert.rejects(service(ids.order), /ledger totals must balance/i);
  assert.equal(writes.length, 0);
});

test("does not grant book access until a matching payment ledger entry exists", async () => {
  const { service, records, writes } = makeService();
  records.ledger = null;
  await assert.rejects(service(ids.order), { code: "PAYMENT_LEDGER_REQUIRED" });
  assert.equal(writes.length, 0);
});

test("requires the persisted signature-verified event referenced by the ledger", async () => {
  const { service, records, writes } = makeService();
  records.paymentEvent = null;
  await assert.rejects(service(ids.order), { code: "VERIFIED_PAYMENT_REQUIRED" });
  assert.equal(writes.length, 0);
});

test("rejects a verified event whose amount differs from the order", async () => {
  const { service, records, writes } = makeService();
  records.paymentEvent = { ...paymentEvent, amountPaise: 12800 };
  await assert.rejects(service(ids.order), { code: "VERIFIED_PAYMENT_REQUIRED" });
  assert.equal(writes.length, 0);
});

test("grants a single-book entitlement only after a paid balanced order", async () => {
  const { service, writes } = makeService();
  const result = await service(ids.order);
  assert.equal(result.replayed, false);
  assert.equal(result.entitlement.bookId, "quiet-between");
  assert.equal(result.entitlement.readerId, ids.reader);
  assert.equal(writes.length, 1);
});

test("replays the existing grant for the same paid order without writing again", async () => {
  const existing = {
    _id: "entitlement-1",
    readerId: ids.reader,
    bookId: "quiet-between",
    orderId: ids.order,
    sourceLedgerId: ids.ledger,
    amountPaise: 12900,
    currency: "INR",
  };
  const { service, records, writes } = makeService();
  records.byOrder = existing;
  const result = await service(ids.order);
  assert.equal(result.replayed, true);
  assert.equal(writes.length, 0);
});

test("does not create duplicate access records when the reader already owns the book", async () => {
  const existing = { _id: "entitlement-existing", readerId: ids.reader, bookId: "quiet-between" };
  const { service, records, writes } = makeService();
  records.byReaderBook = existing;
  const result = await service(ids.order);
  assert.equal(result.alreadyOwned, true);
  assert.equal(result.entitlement, existing);
  assert.equal(writes.length, 0);
});
