import assert from "node:assert/strict";
import test from "node:test";
import { serializeLedgerTransaction } from "./admin-ledger.controller.js";

test("ledger journal serialization omits idempotency and provider references", () => {
  const result = serializeLedgerTransaction({
    _id: "ledger-internal-id",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    eventType: "order_payment",
    orderId: "order-internal-id",
    currency: "INR",
    sourceId: "provider:event-private",
    sourceKeyHash: "a".repeat(64),
    entries: [
      { accountCode: "cash.gateway", direction: "debit", amountPaise: 1299 },
      { accountCode: "sales.receivable", direction: "credit", amountPaise: 1299 },
    ],
  });

  assert.deepEqual(result, {
    id: "ledger-internal-id",
    occurredAt: new Date("2026-01-01T00:00:00.000Z"),
    eventType: "order_payment",
    orderId: "order-internal-id",
    currency: "INR",
    entries: [
      { accountCode: "cash.gateway", direction: "debit", amountPaise: 1299 },
      { accountCode: "sales.receivable", direction: "credit", amountPaise: 1299 },
    ],
  });
  assert.equal("sourceId" in result, false);
  assert.equal("sourceKeyHash" in result, false);
});