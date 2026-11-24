import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { serializeReaderOrder } from "./reader-orders.controller.js";

test("reader order serialization returns only the safe order-history fields", () => {
  const record = {
    _id: new mongoose.Types.ObjectId(),
    buyerId: new mongoose.Types.ObjectId(),
    bookId: "quiet-river",
    bookTitle: { en: "Quiet River", gu: "શાંત નદી", hi: "शांत नदी" },
    authorName: "A. Writer",
    amountPaise: 12500,
    currency: "INR",
    status: "paid",
    createdAt: new Date("2026-11-24T12:00:00.000Z"),
    paidAt: new Date("2026-11-24T12:01:00.000Z"),
    paymentProvider: "private-gateway",
    paymentReference: "private-payment-id",
    idempotencyKeyHash: "d".repeat(64),
    providerSecret: "never-return",
  };

  const result = serializeReaderOrder(record);
  assert.deepEqual(Object.keys(result).sort(), [
    "amountPaise",
    "authorName",
    "bookId",
    "bookTitle",
    "createdAt",
    "currency",
    "id",
    "paidAt",
    "status",
  ]);
  assert.equal(result.id, String(record._id));
  assert.equal(result.amountPaise, 12500);
  assert.equal("buyerId" in result, false);
  assert.equal("paymentReference" in result, false);
  assert.equal("providerSecret" in result, false);
});

test("reader order serialization handles an order that has not been paid", () => {
  const result = serializeReaderOrder({
    _id: new mongoose.Types.ObjectId(),
    bookId: "quiet-river",
    bookTitle: { en: "Quiet River", gu: "શાંત નદી", hi: "शांत नदी" },
    authorName: "A. Writer",
    amountPaise: 12500,
    currency: "INR",
    status: "pending_payment",
    createdAt: new Date(),
  });
  assert.equal(result.paidAt, null);
});
