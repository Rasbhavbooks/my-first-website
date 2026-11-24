import mongoose from "mongoose";
import DigitalBookOrder from "./order.model.js";
import DigitalBookPaymentAttempt from "./payment-attempt.model.js";
import DigitalBookPaymentEvent from "./payment-event.model.js";

function fail(message, code = "INVALID_PAYMENT_APPLICATION") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function validVerifiedEvent(event) {
  const verifiedAt = event?.signatureVerifiedAt;
  return event?.outcome === "applied"
    && event.eventType === "payment.captured"
    && Boolean(event.provider)
    && Boolean(event.eventId)
    && Boolean(event.providerPaymentId)
    && verifiedAt
    && !Number.isNaN(new Date(verifiedAt).getTime())
    && Number.isSafeInteger(event.amountPaise)
    && event.amountPaise > 0
    && event.currency === "INR";
}

export function createCapturedPaymentApplicationService({
  findPaymentEventById,
  findOrderById,
  findAttemptByProviderPaymentId,
}) {
  if (
    typeof findPaymentEventById !== "function"
    || typeof findOrderById !== "function"
    || typeof findAttemptByProviderPaymentId !== "function"
  ) {
    throw new TypeError("Payment application requires authoritative event, order, and attempt lookups.");
  }

  return async function applyCapturedPayment(paymentEventId, { session, now = new Date() } = {}) {
    if (!session || typeof session.inTransaction !== "function" || !session.inTransaction()) {
      throw fail("Captured payments must be applied inside a MongoDB transaction.", "TRANSACTION_REQUIRED");
    }
    if (typeof paymentEventId !== "string" || !/^[a-f0-9]{24}$/i.test(paymentEventId)) {
      throw fail("A persisted payment event ID is required.", "INVALID_PAYMENT_EVENT_ID");
    }

    // All facts come from persisted records; callers cannot supply amounts, verification, or references.
    const event = await findPaymentEventById(paymentEventId, { session });
    if (!event) throw fail("The payment event was not found.", "PAYMENT_EVENT_NOT_FOUND");
    if (!validVerifiedEvent(event)) {
      throw fail("Only persisted, applied, signature-verified captured payment events are accepted.");
    }

    const order = await findOrderById(event.orderId, { session });
    if (!order) throw fail("The payment event order was not found.", "PAYMENT_ORDER_NOT_FOUND");
    if (
      order.amountPaise !== event.amountPaise
      || order.currency !== event.currency
      || order.currency !== "INR"
    ) {
      throw fail("The verified amount and currency must match the one-book order.");
    }

    const attempt = await findAttemptByProviderPaymentId(
      event.provider,
      event.providerPaymentId,
      { session },
    );
    if (!attempt) throw fail("The payment attempt was not found.", "PAYMENT_ATTEMPT_NOT_FOUND");
    if (
      String(attempt.orderId) !== String(order._id ?? order.id)
      || attempt.provider !== event.provider
      || attempt.amountPaise !== event.amountPaise
      || attempt.currency !== event.currency
      || attempt.providerPaymentId !== event.providerPaymentId
    ) {
      throw fail("The verified payment does not match its payment attempt and order.");
    }

    if (order.status === "paid" && attempt.status === "captured") {
      if (
        order.paymentProvider !== event.provider
        || order.paymentReference !== event.providerPaymentId
      ) {
        throw fail("The paid order is linked to a different captured payment.");
      }
      return { applied: true, replayed: true };
    }

    if (order.status !== "pending_payment") {
      throw fail("Only a pending one-book order can be marked paid.");
    }
    if (!["created", "pending", "authorized"].includes(attempt.status)) {
      throw fail("Only an uncaptured payment attempt can be captured.");
    }

    attempt.transitionTo("captured", now);
    await attempt.save({ session });
    order.transitionTo("paid", {
      now,
      paymentProvider: event.provider,
      paymentReference: event.providerPaymentId,
    });
    await order.save({ session });

    return { applied: true, replayed: false };
  };
}

const defaultService = createCapturedPaymentApplicationService({
  findPaymentEventById: (paymentEventId, { session } = {}) => {
    let query = DigitalBookPaymentEvent.findById(paymentEventId).select("+providerPaymentId");
    if (session) query = query.session(session);
    return query;
  },
  findOrderById: (orderId, { session } = {}) => {
    let query = DigitalBookOrder.findById(orderId).select("+paymentReference");
    if (session) query = query.session(session);
    return query;
  },
  findAttemptByProviderPaymentId: (provider, providerPaymentId, { session } = {}) => {
    let query = DigitalBookPaymentAttempt.findOne({ provider, providerPaymentId })
      .select("+providerPaymentId");
    if (session) query = query.session(session);
    return query;
  },
});

export default defaultService;
