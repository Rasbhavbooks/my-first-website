import { createHash } from "node:crypto";
import mongoose from "mongoose";
import DigitalBookOrder from "./order.model.js";
import DigitalBookPaymentAttempt from "./payment-attempt.model.js";

function fail(message, code = "INVALID_PAYMENT_ATTEMPT") {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function createPaymentAttemptService({
  findOrderById,
  findAttemptByIdempotency,
  findLatestAttempt,
  createAttempt,
}) {
  if (
    typeof findOrderById !== "function"
    || typeof findAttemptByIdempotency !== "function"
    || typeof findLatestAttempt !== "function"
    || typeof createAttempt !== "function"
  ) {
    throw new TypeError("Payment attempt service requires authoritative order and attempt persistence adapters.");
  }

  return async function createPaymentAttempt({ buyerId, orderId, provider, idempotencyKey }, { session } = {}) {
    if (!session || typeof session.inTransaction !== "function" || !session.inTransaction()) {
      throw fail("Payment attempts must be created inside a MongoDB transaction.", "TRANSACTION_REQUIRED");
    }
    if (!mongoose.isValidObjectId(buyerId) || !mongoose.isValidObjectId(orderId)) {
      throw fail("A valid reader and order are required.", "INVALID_ORDER_REFERENCE");
    }
    const normalizedProvider = String(provider ?? "").trim().toLowerCase();
    if (!/^[a-z0-9-]{1,40}$/.test(normalizedProvider)) {
      throw fail("A configured payment provider is required.", "PAYMENT_PROVIDER_NOT_CONFIGURED");
    }
    if (
      typeof idempotencyKey !== "string"
      || idempotencyKey.length < 16
      || idempotencyKey.length > 128
      || idempotencyKey.trim() !== idempotencyKey
    ) {
      throw fail("A 16–128 character idempotency key is required.", "INVALID_IDEMPOTENCY_KEY");
    }

    const order = await findOrderById(orderId, { session });
    if (!order || String(order.buyerId) !== String(buyerId)) {
      throw fail("The order was not found for this reader.", "ORDER_NOT_FOUND");
    }
    const idempotencyKeyHash = createHash("sha256").update(idempotencyKey).digest("hex");
    const existing = await findAttemptByIdempotency(orderId, idempotencyKeyHash, { session });
    if (existing) {
      if (existing.provider !== normalizedProvider) {
        throw fail("This idempotency key was already used with another provider.", "IDEMPOTENCY_KEY_REUSED");
      }
      return { attempt: existing, replayed: true };
    }

    if (order.status !== "pending_payment") {
      throw fail("A payment attempt can only be created for an unpaid order.", "ORDER_NOT_PAYABLE");
    }
    if (!Number.isSafeInteger(order.amountPaise) || order.amountPaise < 1 || order.currency !== "INR") {
      throw fail("The order must have a valid whole-paise INR amount.", "INVALID_ORDER_AMOUNT");
    }

    const latest = await findLatestAttempt(orderId, { session });
    if (latest && !["failed", "cancelled"].includes(latest.status)) {
      throw fail("The current payment attempt must finish before another can be started.", "PAYMENT_ATTEMPT_ACTIVE");
    }

    const attemptData = {
      orderId,
      attemptNumber: (latest?.attemptNumber || 0) + 1,
      idempotencyKeyHash,
      provider: normalizedProvider,
      amountPaise: order.amountPaise,
      currency: order.currency,
      status: "created",
    };
    const attempt = await createAttempt(attemptData, { session });
    return { attempt, replayed: false };
  };
}

const defaultService = createPaymentAttemptService({
  findOrderById: (orderId, { session } = {}) => {
    let query = DigitalBookOrder.findById(orderId);
    if (session) query = query.session(session);
    return query;
  },
  findAttemptByIdempotency: (orderId, idempotencyKeyHash, { session } = {}) => {
    let query = DigitalBookPaymentAttempt.findOne({ orderId, idempotencyKeyHash })
      .select("+idempotencyKeyHash");
    if (session) query = query.session(session);
    return query;
  },
  findLatestAttempt: (orderId, { session } = {}) => {
    let query = DigitalBookPaymentAttempt.findOne({ orderId })
      .sort({ attemptNumber: -1, _id: -1 });
    if (session) query = query.session(session);
    return query;
  },
  createAttempt: (data, { session } = {}) => new DigitalBookPaymentAttempt(data).save({ session }),
});

export default defaultService;
