import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { createRazorpayWebhookVerifier } from "./razorpay-webhook.js";

const secret = "test-webhook-secret";
const providerOrderId = "order_test_123";
const rawBody = Buffer.from(JSON.stringify({
  event: "payment.captured",
  payload: { payment: { entity: {
    id: "pay_test_123",
    order_id: providerOrderId,
    amount: 1250,
    currency: "INR",
  } } },
}));
const signature = createHmac("sha256", secret).update(rawBody).digest("hex");
const headers = { "x-razorpay-signature": signature, "x-razorpay-event-id": "evt_test_123" };

test("verifies raw bytes and maps a captured Razorpay event to its local attempt", async () => {
  const verifier = createRazorpayWebhookVerifier({
    webhookSecret: secret,
    findAttemptByProviderOrderId: async (id) => id === providerOrderId
      ? { orderId: "507f1f77bcf86cd799439011" }
      : null,
  });

  const result = await verifier({ rawBody, headers });
  assert.equal(result.signatureVerified, true);
  assert.equal(result.provider, "razorpay");
  assert.equal(result.eventId, "evt_test_123");
  assert.equal(result.eventType, "payment.captured");
  assert.equal(result.orderId, "507f1f77bcf86cd799439011");
  assert.equal(result.providerPaymentId, "pay_test_123");
  assert.equal(result.amountPaise, 1250);
  assert.equal(result.currency, "INR");
  assert.ok(result.signatureVerifiedAt instanceof Date);
});

test("rejects a signature that does not match the original request bytes", async () => {
  const verifier = createRazorpayWebhookVerifier({
    webhookSecret: secret,
    findAttemptByProviderOrderId: async () => ({ orderId: "507f1f77bcf86cd799439011" }),
  });

  await assert.rejects(
    verifier({ rawBody: Buffer.concat([rawBody, Buffer.from(" ") ]), headers }),
    { code: "SIGNATURE_VERIFICATION_FAILED" },
  );
});

test("rejects events whose gateway order is not linked to a local attempt", async () => {
  const verifier = createRazorpayWebhookVerifier({
    webhookSecret: secret,
    findAttemptByProviderOrderId: async () => null,
  });

  await assert.rejects(verifier({ rawBody, headers }), { code: "PAYMENT_ATTEMPT_NOT_FOUND" });
});
