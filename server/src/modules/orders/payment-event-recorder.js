import mongoose from "mongoose";
import DigitalBookPaymentEvent from "./payment-event.model.js";
import verifyRazorpayWebhook from "./razorpay-webhook.js";

function fail(message, code = "INVALID_PAYMENT_EVENT") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function eventFactsMatch(existing, facts) {
  return String(existing.orderId) === String(facts.orderId)
    && existing.provider === facts.provider
    && existing.eventId === facts.eventId
    && existing.eventType === facts.eventType
    && (existing.providerPaymentId || "") === (facts.providerPaymentId || "")
    && existing.amountPaise === facts.amountPaise
    && existing.currency === facts.currency;
}

function normalizeVerifiedFacts(verified) {
  const provider = String(verified?.provider ?? "").trim().toLowerCase();
  const eventId = String(verified?.eventId ?? "").trim();
  const eventType = String(verified?.eventType ?? "").trim().toLowerCase();
  const providerPaymentId = String(verified?.providerPaymentId ?? "").trim();
  const signatureVerifiedAt = verified?.signatureVerifiedAt;
  const orderId = verified?.orderId;
  const paymentAttemptId = verified?.paymentAttemptId;
  const providerOrderId = String(verified?.providerOrderId ?? "").trim();
  const amountPaise = verified?.amountPaise;
  const currency = String(verified?.currency ?? "").trim().toUpperCase();

  if (!/^[a-z0-9-]{1,40}$/.test(provider)) {
    throw fail("The verified event must identify a supported payment provider.");
  }
  if (!eventId || eventId.length > 160) {
    throw fail("The verified event must have a valid provider event ID.");
  }
  if (!eventType || eventType.length > 100) {
    throw fail("The verified event must have a normalized event type.");
  }
  if (providerPaymentId.length > 160) {
    throw fail("The provider payment reference is too long.");
  }
  if (!mongoose.isValidObjectId(orderId)) {
    throw fail("The verified event must map to an existing order ID.");
  }
  if (!mongoose.isValidObjectId(paymentAttemptId)) {
    throw fail("The verified event must map to an exact payment attempt ID.");
  }
  if (!providerOrderId || providerOrderId.length > 160) {
    throw fail("The verified event must include its trusted provider order reference.");
  }
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 1 || currency !== "INR") {
    throw fail("Only positive whole-paise INR payment events can be recorded.");
  }
  if (!signatureVerifiedAt || Number.isNaN(new Date(signatureVerifiedAt).getTime())) {
    throw fail("A successfully signature-verified event is required.", "SIGNATURE_VERIFICATION_REQUIRED");
  }

  let outcome = "ignored";
  if (eventType === "payment.captured") outcome = "applied";
  // A failed payment can later be captured, even with the same provider payment ID.
  if (eventType === "payment.failed") outcome = "failed";
  return {
    orderId,
    paymentAttemptId,
    providerOrderId,
    provider,
    eventId,
    eventType,
    providerPaymentId,
    amountPaise,
    currency,
    signatureVerifiedAt: new Date(signatureVerifiedAt),
    outcome,
  };
}

export function createPaymentEventRecorder({
  verifyAndNormalize,
  findByProviderEventId,
  createRecord,
  linkLegacyEvent,
}) {
  if (
    typeof verifyAndNormalize !== "function"
    || typeof findByProviderEventId !== "function"
    || typeof createRecord !== "function"
  ) {
    throw new TypeError("Payment event recorder requires a signature verifier and persistence adapters.");
  }

  async function replay(existing, facts) {
    if (!eventFactsMatch(existing, facts)) {
      throw fail("This provider event ID was already recorded with different signed facts.", "EVENT_ID_REUSED");
    }
    // A fresh verified delivery can fill the two fields missing from pre-linkage records.
    if (existing.paymentAttemptId == null && existing.providerOrderId == null && linkLegacyEvent) {
      existing = await linkLegacyEvent(existing._id, facts);
    }
    if (!existing || String(existing.paymentAttemptId) !== String(facts.paymentAttemptId)
      || existing.providerOrderId !== facts.providerOrderId) {
      throw fail("The provider event is linked to another attempt.", "EVENT_ID_REUSED");
    }
    return { event: existing, replayed: true };
  }

  return async function recordPaymentEvent({ rawBody, headers }) {
    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0 || rawBody.length > 256 * 1024) {
      throw fail("The original webhook body must be a non-empty buffer up to 256 KB.");
    }
    if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
      throw fail("Payment webhook headers are required for signature verification.");
    }

    // Provider adapters must verify the original bytes before returning normalized facts.
    // The raw request body is passed only to the verifier and is never sent to persistence.
    const verified = await verifyAndNormalize({ rawBody, headers });
    if (!verified || verified.signatureVerified !== true) {
      throw fail("The provider webhook signature could not be verified.", "SIGNATURE_VERIFICATION_FAILED");
    }
    const facts = normalizeVerifiedFacts(verified);
    const existing = await findByProviderEventId(facts.provider, facts.eventId);
    if (existing) return replay(existing, facts);

    try {
      const event = await createRecord(facts);
      return { event, replayed: false };
    } catch (error) {
      if (error?.code !== 11000) throw error;
      const racedEvent = await findByProviderEventId(facts.provider, facts.eventId);
      if (!racedEvent) throw error;
      return replay(racedEvent, facts);
    }
  };
}

const defaultRecorder = createPaymentEventRecorder({
  verifyAndNormalize: verifyRazorpayWebhook,
  findByProviderEventId: (provider, eventId) =>
    DigitalBookPaymentEvent.findOne({ provider, eventId }).select("+providerPaymentId +providerOrderId"),
  linkLegacyEvent: async (id, { paymentAttemptId, providerOrderId }) => {
    // Raw update permits only this one-time backfill of immutable schema paths.
    await DigitalBookPaymentEvent.collection.updateOne(
      { _id: id, paymentAttemptId: { $exists: false }, providerOrderId: { $exists: false } },
      { $set: { paymentAttemptId: new mongoose.Types.ObjectId(String(paymentAttemptId)), providerOrderId } },
    );
    return DigitalBookPaymentEvent.findById(id).select("+providerPaymentId +providerOrderId");
  },
  createRecord: (facts) => new DigitalBookPaymentEvent(facts).save(),
});

export default defaultRecorder;
