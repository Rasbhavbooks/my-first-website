import assert from "node:assert/strict";
import test from "node:test";
import { serializeAdminOrder } from "./admin-orders.controller.js";

test("admin order serialization exposes order facts but excludes reader and gateway secrets", () => {
  const result = serializeAdminOrder({
    _id: "order-id",
    buyerId: "reader-private-id",
    idempotencyKeyHash: "a".repeat(64),
    paymentProvider: "gateway-private",
    paymentReference: "provider-payment-private",
    bookId: "quiet-river",
    bookTitle: { en: "Quiet River", gu: "શાંત નદી", hi: "शांत नदी" },
    authorName: "A. Writer",
    amountPaise: 4900,
    currency: "INR",
    status: "paid",
    createdAt: new Date("2026-11-25T10:00:00.000Z"),
    paidAt: new Date("2026-11-25T10:01:00.000Z"),
    cancelledAt: null,
    refundedAt: null,
  });

  assert.deepEqual(result, {
    id: "order-id",
    bookId: "quiet-river",
    bookTitle: { en: "Quiet River", gu: "શાંત નદી", hi: "शांत नदी" },
    authorName: "A. Writer",
    amountPaise: 4900,
    currency: "INR",
    status: "paid",
    createdAt: new Date("2026-11-25T10:00:00.000Z"),
    paidAt: new Date("2026-11-25T10:01:00.000Z"),
    cancelledAt: null,
    refundedAt: null,
  });
  for (const key of ["buyerId", "idempotencyKeyHash", "paymentProvider", "paymentReference"]) {
    assert.equal(key in result, false);
  }
});
