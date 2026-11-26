import mongoose from "mongoose";
import DigitalBookOrder from "./order.model.js";
import DigitalBookPaymentAttempt from "./payment-attempt.model.js";
import DigitalBookPaymentEvent from "./payment-event.model.js";
import PaymentRefundRequest from "./refund-request.model.js";

function fail(message, code = "INVALID_REFUND_REQUEST") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function sameId(left, right) {
  return String(left?._id ?? left?.id ?? left) === String(right?._id ?? right?.id ?? right);
}

export function createDuplicateRefundQueue({
  findPaymentEventById,
  findOrderById,
  findAttemptById,
  findBySourcePaymentEventId,
  createRequest,
}) {
  for (const dependency of [findPaymentEventById, findOrderById, findAttemptById, findBySourcePaymentEventId, createRequest]) {
    if (typeof dependency !== "function") throw new TypeError("Refund queue requires authoritative payment and order lookups.");
  }

  return async function queueDuplicatePaymentRefund(paymentEventId, { session } = {}) {
    if (!session || typeof session.inTransaction !== "function" || !session.inTransaction()) {
      throw fail("Duplicate payment refunds must be queued in a database transaction.", "TRANSACTION_REQUIRED");
    }
    if (typeof paymentEventId !== "string" || !/^[a-f0-9]{24}$/i.test(paymentEventId)) {
      throw fail("A persisted payment event ID is required.");
    }
    const event = await findPaymentEventById(paymentEventId, { session });
    if (!event || event.outcome !== "applied" || event.eventType !== "payment.captured"
      || !event.signatureVerifiedAt || !event.providerPaymentId) {
      throw fail("Only a persisted, verified captured payment can be queued for refund.", "VERIFIED_PAYMENT_REQUIRED");
    }
    const order = await findOrderById(event.orderId, { session });
    const attempt = await findAttemptById(event.paymentAttemptId, { session });
    if (!order || !attempt || order.status !== "paid" || order.currency !== "INR"
      || order.amountPaise !== event.amountPaise || order.paymentProvider !== event.provider
      || order.paymentReference === event.providerPaymentId) {
      throw fail("The capture is not a duplicate payment for a paid order.", "NOT_A_DUPLICATE_PAYMENT");
    }
    if (String(attempt.orderId) !== String(order._id ?? order.id)
      || attempt.provider !== event.provider || attempt.providerOrderId !== event.providerOrderId
      || attempt.amountPaise !== event.amountPaise || attempt.currency !== "INR") {
      throw fail("The duplicate capture does not match its local payment attempt.");
    }

    const existing = await findBySourcePaymentEventId(event._id ?? event.id, { session });
    if (existing) {
      if (!sameId(existing.orderId, order._id ?? order.id)
        || !sameId(existing.paymentAttemptId, attempt._id ?? attempt.id)
        || !sameId(existing.sourcePaymentEventId, event._id ?? event.id)
        || existing.provider !== event.provider
        || existing.providerPaymentId !== event.providerPaymentId
        || existing.amountPaise !== event.amountPaise
        || existing.reason !== "duplicate_payment") {
        throw fail("This payment event already has a conflicting refund request.", "REFUND_REQUEST_CONFLICT");
      }
      return { refundRequest: existing, replayed: true };
    }

    const record = {
      orderId: order._id ?? order.id,
      paymentAttemptId: attempt._id ?? attempt.id,
      sourcePaymentEventId: event._id ?? event.id,
      provider: event.provider,
      providerPaymentId: event.providerPaymentId,
      amountPaise: event.amountPaise,
      currency: "INR",
      reason: "duplicate_payment",
      status: "pending",
    };
    try {
      const refundRequest = await createRequest(record, { session });
      return { refundRequest, replayed: false };
    } catch (error) {
      if (error?.code !== 11000) throw error;
      const raced = await findBySourcePaymentEventId(event._id ?? event.id, { session });
      if (raced
        && sameId(raced.orderId, order._id ?? order.id)
        && raced.providerPaymentId === event.providerPaymentId
        && raced.amountPaise === event.amountPaise
        && raced.reason === "duplicate_payment") {
        return { refundRequest: raced, replayed: true };
      }
      throw error;
    }
  };
}

function withSession(query, session) {
  return session ? query.session(session) : query;
}

const defaultQueue = createDuplicateRefundQueue({
  findPaymentEventById: (id, { session } = {}) => withSession(
    DigitalBookPaymentEvent.findById(id).select("+providerPaymentId +providerOrderId"),
    session,
  ),
  findOrderById: (id, { session } = {}) => withSession(
    DigitalBookOrder.findById(id).select("+paymentReference"),
    session,
  ),
  findAttemptById: (id, { session } = {}) => withSession(
    DigitalBookPaymentAttempt.findById(id).select("+providerOrderId"),
    session,
  ),
  findBySourcePaymentEventId: (id, { session } = {}) => withSession(
    PaymentRefundRequest.findOne({ sourcePaymentEventId: id }).select("+providerPaymentId +providerRefundId"),
    session,
  ),
  createRequest: (record, { session } = {}) => new PaymentRefundRequest(record).save({ session }),
});

export default defaultQueue;
