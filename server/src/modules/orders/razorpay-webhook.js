import { createHmac, timingSafeEqual } from "node:crypto";
import DigitalBookPaymentAttempt from "./payment-attempt.model.js";
import { env } from "../../config/env.js";

function fail(message, code = "INVALID_RAZORPAY_WEBHOOK") {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function createRazorpayWebhookVerifier({ webhookSecret, findAttemptByProviderOrderId }) {
  if (typeof findAttemptByProviderOrderId !== "function") {
    throw new TypeError("Razorpay webhook verification requires a payment-attempt lookup.");
  }

  return async function verifyAndNormalize({ rawBody, headers }) {
    if (!webhookSecret) {
      throw fail("Razorpay webhook verification is not configured.", "PAYMENT_PROVIDER_NOT_CONFIGURED");
    }
    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
      throw fail("The original Razorpay webhook bytes are required.");
    }

    const signature = String(headers?.["x-razorpay-signature"] ?? "");
    if (!/^[a-f0-9]{64}$/i.test(signature)) {
      throw fail("The Razorpay webhook signature is missing or malformed.", "SIGNATURE_VERIFICATION_FAILED");
    }
    const expected = createHmac("sha256", webhookSecret).update(rawBody).digest();
    const received = Buffer.from(signature, "hex");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw fail("The Razorpay webhook signature is invalid.", "SIGNATURE_VERIFICATION_FAILED");
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      throw fail("The signed Razorpay webhook body is not valid JSON.");
    }

    const eventId = String(headers?.["x-razorpay-event-id"] ?? "").trim();
    const eventType = String(payload?.event ?? "").trim().toLowerCase();
    const payment = payload?.payload?.payment?.entity;
    const providerOrderId = String(payment?.order_id ?? "").trim();
    const providerPaymentId = String(payment?.id ?? "").trim();
    const amountPaise = payment?.amount;
    const currency = String(payment?.currency ?? "").toUpperCase();

    if (!eventId || eventId.length > 160 || !eventType || eventType.length > 100) {
      throw fail("The Razorpay webhook event identity is invalid.");
    }
    if (!providerOrderId || !providerPaymentId) {
      throw fail("The signed Razorpay payment is missing its order or payment reference.");
    }
    if (!Number.isSafeInteger(amountPaise) || amountPaise < 1 || currency !== "INR") {
      throw fail("Only positive whole-paise INR Razorpay payments are supported.");
    }

    const attempt = await findAttemptByProviderOrderId(providerOrderId);
    if (!attempt) {
      throw fail("The Razorpay order does not match a local payment attempt.", "PAYMENT_ATTEMPT_NOT_FOUND");
    }

    return {
      signatureVerified: true,
      signatureVerifiedAt: new Date(),
      provider: "razorpay",
      eventId,
      eventType,
      orderId: attempt.orderId,
      providerPaymentId,
      amountPaise,
      currency,
    };
  };
}

const defaultVerifier = createRazorpayWebhookVerifier({
  webhookSecret: env.razorpayWebhookSecret,
  findAttemptByProviderOrderId: (providerOrderId) => DigitalBookPaymentAttempt
    .findOne({ provider: "razorpay", providerOrderId })
    .select("+providerOrderId"),
});

export default defaultVerifier;
