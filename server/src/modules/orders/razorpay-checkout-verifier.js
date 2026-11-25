import { createHmac, timingSafeEqual } from "node:crypto";
import mongoose from "mongoose";
import DigitalBookOrder from "./order.model.js";
import DigitalBookPaymentAttempt from "./payment-attempt.model.js";
import { env } from "../../config/env.js";

function fail(message, code = "INVALID_RAZORPAY_CHECKOUT") {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function createRazorpayCheckoutVerifier({ keySecret, findAttemptByProviderOrderId }) {
  if (typeof findAttemptByProviderOrderId !== "function") {
    throw new TypeError("Razorpay checkout verification requires a private payment-attempt lookup.");
  }

  return async function verifyCheckoutResponse({ buyerId, razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    if (!keySecret) {
      throw fail("Razorpay checkout verification is not configured.", "PAYMENT_PROVIDER_NOT_CONFIGURED");
    }
    if (!mongoose.isValidObjectId(buyerId)) {
      throw fail("A valid signed-in reader is required.", "INVALID_CHECKOUT_BUYER");
    }

    const suppliedOrderId = String(razorpayOrderId ?? "").trim();
    const paymentId = String(razorpayPaymentId ?? "").trim();
    const signature = String(razorpaySignature ?? "").trim();
    if (!/^order_[A-Za-z0-9]{1,150}$/.test(suppliedOrderId)) throw fail("The Razorpay order reference is invalid.");
    if (!/^pay_[A-Za-z0-9]{1,150}$/.test(paymentId)) throw fail("The Razorpay payment reference is invalid.");
    if (!/^[a-f0-9]{64}$/i.test(signature)) {
      throw fail("The Razorpay checkout signature is missing or malformed.", "SIGNATURE_VERIFICATION_FAILED");
    }

    // Look up the server-created attempt owned by this reader before building the HMAC.
    const attempt = await findAttemptByProviderOrderId(suppliedOrderId);
    if (
      !attempt
      || attempt.provider !== "razorpay"
      || String(attempt.buyerId) !== String(buyerId)
      || attempt.providerOrderId !== suppliedOrderId
    ) {
      throw fail("The Razorpay order was not found for this reader.", "PAYMENT_ATTEMPT_NOT_FOUND");
    }
    if (!Number.isSafeInteger(attempt.amountPaise) || attempt.amountPaise < 1 || attempt.currency !== "INR") {
      throw fail("The stored payment attempt has invalid amount or currency.");
    }

    const expected = createHmac("sha256", keySecret)
      .update(`${attempt.providerOrderId}|${paymentId}`)
      .digest();
    const received = Buffer.from(signature, "hex");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw fail("The Razorpay checkout signature is invalid.", "SIGNATURE_VERIFICATION_FAILED");
    }

    return {
      signatureVerified: true,
      provider: "razorpay",
      attemptId: String(attempt._id),
      orderId: attempt.orderId,
      providerOrderId: attempt.providerOrderId,
      providerPaymentId: paymentId,
      amountPaise: attempt.amountPaise,
      currency: attempt.currency,
    };
  };
}

const defaultVerifier = createRazorpayCheckoutVerifier({
  keySecret: env.razorpayKeySecret,
  findAttemptByProviderOrderId: async (providerOrderId) => {
    const attempt = await DigitalBookPaymentAttempt.findOne({ provider: "razorpay", providerOrderId })
      .select("+providerOrderId");
    if (!attempt) return null;
    const order = await DigitalBookOrder.findById(attempt.orderId).select("buyerId");
    if (!order) return null;
    return {
      _id: attempt._id,
      orderId: attempt.orderId,
      provider: attempt.provider,
      providerOrderId: attempt.providerOrderId,
      amountPaise: attempt.amountPaise,
      currency: attempt.currency,
      buyerId: order.buyerId,
    };
  },
});

export default defaultVerifier;
