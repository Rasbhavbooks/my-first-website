import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import LedgerTransaction from "./ledger-transaction.model.js";

function validTransaction(overrides = {}) {
  return new LedgerTransaction({
    eventType: "order_payment",
    sourceType: "payment_event",
    sourceId: "payment-event-123",
    sourceKeyHash: "b".repeat(64),
    orderId: new mongoose.Types.ObjectId(),
    entries: [
      { accountCode: "gateway_clearing", direction: "debit", amountPaise: 12500 },
      { accountCode: "customer_receivable", direction: "credit", amountPaise: 12500 },
    ],
    ...overrides,
  });
}

test("ledger accepts balanced whole-paise transactions", async () => {
  const transaction = validTransaction();
  await transaction.validate();

  assert.equal(transaction.currency, "INR");
  assert.equal(transaction.entries.length, 2);
  assert.equal(transaction.updatedAt, undefined);
});

test("ledger rejects unbalanced transactions", async () => {
  const transaction = validTransaction({
    entries: [
      { accountCode: "gateway_clearing", direction: "debit", amountPaise: 12500 },
      { accountCode: "customer_receivable", direction: "credit", amountPaise: 12499 },
    ],
  });
  await assert.rejects(transaction.validate(), /totals must balance/);
});

test("ledger rejects fractional paise, invalid entries, and non-INR currency", async () => {
  await assert.rejects(validTransaction({
    entries: [
      { accountCode: "gateway_clearing", direction: "debit", amountPaise: 12.5 },
      { accountCode: "customer_receivable", direction: "credit", amountPaise: 12.5 },
    ],
  }).validate(), /whole paise/);

  await assert.rejects(validTransaction({ currency: "USD" }).validate());
  await assert.rejects(validTransaction({
    entries: [
      { accountCode: "gateway_clearing", direction: "transfer", amountPaise: 100 },
      { accountCode: "customer_receivable", direction: "credit", amountPaise: 100 },
    ],
  }).validate());
});

test("ledger transactions reject empty or oversized entry sets", async () => {
  await assert.rejects(validTransaction({ entries: [] }).validate(), /between 2 and 20 entries/);
  const entries = Array.from({ length: 21 }, (_, index) => ({
    accountCode: "account." + index,
    direction: index % 2 ? "credit" : "debit",
    amountPaise: 1,
  }));
  await assert.rejects(validTransaction({ entries }).validate(), /between 2 and 20 entries/);
});

test("ledger fields are immutable and idempotency hash is private", () => {
  assert.equal(LedgerTransaction.schema.path("entries").options.immutable, true);
  assert.equal(LedgerTransaction.schema.path("sourceKeyHash").options.select, false);
  assert.equal(LedgerTransaction.schema.path("eventType").options.immutable, true);
});
