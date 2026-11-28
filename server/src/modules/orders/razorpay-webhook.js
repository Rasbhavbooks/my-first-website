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
    const paymentFailed = eventType === "payment.failed";
    if (paymentFailed && (payment?.status !== "failed" || !/^pay_[A-Za-z0-9]{1,150}$/.test(providerPaymentId))) {
      throw fail("The signed Razorpay failure does not identify a failed payment.");
    }
    if (!Number.isSafeInteger(amountPaise) || amountPaise < 1 || (currency !== "INR" && !(paymentFailed && currency === ""))) {
      throw fail("Only positive whole-paise INR Razorpay payments are supported.");
    }

    const attempt = await findAttemptByProviderOrderId(providerOrderId);
    if (!attempt) {
      throw fail("The Razorpay order does not match a local payment attempt.", "PAYMENT_ATTEMPT_NOT_FOUND");
    }

    // Some failed Razorpay notifications omit the currency. The matched INR attempt supplies it.
    if (paymentFailed && (attempt.currency !== "INR" || attempt.amountPaise !== amountPaise)) {
      throw fail("The failed Razorpay payment does not match the local amount and currency.");
    }

    return {
      signatureVerified: true,
      signatureVerifiedAt: new Date(),
      provider: "razorpay",
      eventId,
      eventType,
      orderId: attempt.orderId,
      paymentAttemptId: attempt._id,
      providerOrderId: attempt.providerOrderId,
      providerPaymentId,
      amountPaise,
      currency: paymentFailed ? attempt.currency : currency,
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
