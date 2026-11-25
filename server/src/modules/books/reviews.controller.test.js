import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { reviewDto } from "./reviews.controller.js";

test("public review DTO exposes purchase status without reader or payment identifiers", () => {
  const userId = new mongoose.Types.ObjectId();
  const review = {
    _id: new mongoose.Types.ObjectId(),
    id: "public-review-id",
    userId: { _id: userId, displayName: "Reader Name", avatarUrl: "" },
    rating: 5,
    body: "A thoughtful story and a lovely reading experience.",
    createdAt: new Date("2026-11-25T12:00:00Z"),
    updatedAt: new Date("2026-11-25T12:00:00Z"),
    email: "private@example.test",
    paymentReference: "private-gateway-id",
  };

  const result = reviewDto(review, 3, true);
  assert.equal(result.verifiedPurchase, true);
  assert.equal(result.helpfulCount, 3);
  assert.deepEqual(Object.keys(result).sort(), [
    "body", "createdAt", "helpfulCount", "id", "rating", "reader", "updatedAt", "verifiedPurchase",
  ]);
  assert.deepEqual(Object.keys(result.reader).sort(), ["avatarUrl", "displayName"]);
  assert.equal("userId" in result, false);
  assert.equal("email" in result, false);
  assert.equal("paymentReference" in result, false);
});

test("public review DTO defaults to unverified when no paid entitlement matched", () => {
  const result = reviewDto({
    id: "review-id",
    rating: 4,
    body: "A good book with several memorable passages.",
    createdAt: new Date(),
    updatedAt: new Date(),
    userId: { displayName: "Reader", avatarUrl: "" },
  });
  assert.equal(result.verifiedPurchase, false);
});
