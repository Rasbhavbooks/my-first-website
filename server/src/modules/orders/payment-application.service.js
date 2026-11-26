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
    && Boolean(event.paymentAttemptId)
    && Boolean(event.providerOrderId)
    && verifiedAt
    && !Number.isNaN(new Date(verifiedAt).getTime())
    && Number.isSafeInteger(event.amountPaise)
    && event.amountPaise > 0
    && event.currency === "INR";
}

export function createCapturedPaymentApplicationService({
  findPaymentEventById,
  findOrderById,
  findAttemptById,
}) {
  if (
    typeof findPaymentEventById !== "function"
    || typeof findOrderById !== "function"
    || typeof findAttemptById !== "function"
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

    const attempt = await findAttemptById(event.paymentAttemptId, { session });
    if (!attempt) throw fail("The payment attempt was not found.", "PAYMENT_ATTEMPT_NOT_FOUND");
    if (
      String(attempt._id ?? attempt.id) !== String(event.paymentAttemptId)
      || String(attempt.orderId) !== String(order._id ?? order.id)
      || attempt.provider !== event.provider
      || attempt.providerOrderId !== event.providerOrderId
      || attempt.amountPaise !== event.amountPaise
      || attempt.currency !== event.currency
      || (attempt.providerPaymentId
        && attempt.providerPaymentId !== event.providerPaymentId
        && !(order.status === "paid"
          && order.paymentReference !== event.providerPaymentId
          && attempt.providerPaymentId === order.paymentReference))
    ) {
      throw fail("The verified payment does not match its payment attempt and order.");
    }

    if (order.status === "paid") {
      if (order.paymentProvider !== event.provider) {
        throw fail("The duplicate payment provider does not match the original order payment.");
      }
      if (
        attempt.status === "captured"
        && attempt.providerPaymentId === event.providerPaymentId
        && order.paymentReference === event.providerPaymentId
      ) {
        return { applied: true, replayed: true };
      }
      if (
        ["refund_pending", "refunded"].includes(attempt.status)
        && attempt.providerPaymentId === event.providerPaymentId
        && order.paymentReference !== event.providerPaymentId
      ) {
        return { applied: false, replayed: true, duplicatePayment: true };
      }
      if (
        order.paymentReference !== event.providerPaymentId
        && attempt.providerPaymentId === order.paymentReference
      ) {
        return {
          applied: false,
          replayed: false,
          duplicatePayment: true,
          refundAmountPaise: event.amountPaise,
        };
      }
      if (
        order.paymentReference !== event.providerPaymentId
        && ["created", "pending", "authorized"].includes(attempt.status)
        && !attempt.providerPaymentId
      ) {
        // A separate captured payment for an already-paid order is a duplicate.
        // Record the captured payment privately and flag this attempt for refund.
        // The original order and entitlement remain paid; an external refund call
        // must happen later, outside this database transaction.
        attempt.attachProviderPaymentId(event.providerPaymentId);
        attempt.transitionTo("captured", now);
        await attempt.save({ session });
        attempt.transitionTo("refund_pending", now);
        await attempt.save({ session });
        return {
          applied: false,
          replayed: false,
          duplicatePayment: true,
          refundAmountPaise: event.amountPaise,
        };
      }
      throw fail("The paid order is linked to a different captured payment.");
    }

    if (order.status !== "pending_payment") {
      throw fail("Only a pending one-book order can be marked paid.");
    }
    if (!["created", "pending", "authorized"].includes(attempt.status)) {
      throw fail("Only an uncaptured payment attempt can be captured.");
    }

    attempt.attachProviderPaymentId(event.providerPaymentId);
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
    let query = DigitalBookPaymentEvent.findById(paymentEventId).select("+providerPaymentId +providerOrderId");
    if (session) query = query.session(session);
    return query;
  },
  findOrderById: (orderId, { session } = {}) => {
    let query = DigitalBookOrder.findById(orderId).select("+paymentReference");
    if (session) query = query.session(session);
    return query;
  },
  findAttemptById: (attemptId, { session } = {}) => {
    let query = DigitalBookPaymentAttempt.findById(attemptId)
      .select("+providerOrderId +providerPaymentId");
    if (session) query = query.session(session);
    return query;
  },
});

export default defaultService;
