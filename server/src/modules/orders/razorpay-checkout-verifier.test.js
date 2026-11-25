import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { createRazorpayCheckoutVerifier } from "./razorpay-checkout-verifier.js";

const keySecret = "razorpay-test-key-secret";
const buyerId = "507f1f77bcf86cd799439013";
const attempt = {
  _id: "507f1f77bcf86cd799439011",
  orderId: "507f1f77bcf86cd799439012",
  buyerId,
  provider: "razorpay",
  providerOrderId: "order_trusted123",
  amountPaise: 1250,
  currency: "INR",
};
const paymentId = "pay_test123";
const signature = createHmac("sha256", keySecret).update(`${attempt.providerOrderId}|${paymentId}`).digest("hex");

function verifier(foundAttempt = attempt, secret = keySecret) {
  return createRazorpayCheckoutVerifier({
    keySecret: secret,
    findAttemptByProviderOrderId: async (orderId) => orderId === attempt.providerOrderId ? foundAttempt : null,
  });
}

test("verifies checkout success using the server-stored reader-owned order", async () => {
  const result = await verifier()({
    buyerId, razorpayOrderId: attempt.providerOrderId,
    razorpayPaymentId: paymentId, razorpaySignature: signature,
  });
  assert.deepEqual(result, {
    signatureVerified: true, provider: "razorpay",
    attemptId: attempt._id, orderId: attempt.orderId,
    providerOrderId: attempt.providerOrderId, providerPaymentId: paymentId,
    amountPaise: 1250, currency: "INR",
  });
});

test("rejects a tampered checkout signature", async () => {
  await assert.rejects(verifier()({
    buyerId, razorpayOrderId: attempt.providerOrderId,
    razorpayPaymentId: paymentId, razorpaySignature: "a".repeat(64),
  }), { code: "SIGNATURE_VERIFICATION_FAILED" });
});

test("rejects another reader's order and an order ID without a local attempt", async () => {
  await assert.rejects(verifier({ ...attempt, buyerId: "507f1f77bcf86cd799439014" })({
    buyerId, razorpayOrderId: attempt.providerOrderId,
    razorpayPaymentId: paymentId, razorpaySignature: signature,
  }), { code: "PAYMENT_ATTEMPT_NOT_FOUND" });
  await assert.rejects(verifier()({
    buyerId, razorpayOrderId: "order_untrusted123",
    razorpayPaymentId: paymentId, razorpaySignature: signature,
  }), { code: "PAYMENT_ATTEMPT_NOT_FOUND" });
});

test("fails closed when the server key secret is missing", async () => {
  await assert.rejects(verifier(attempt, "")({
    buyerId, razorpayOrderId: attempt.providerOrderId,
    razorpayPaymentId: paymentId, razorpaySignature: signature,
  }), { code: "PAYMENT_PROVIDER_NOT_CONFIGURED" });
});
