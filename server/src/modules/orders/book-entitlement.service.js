import { createHash } from "node:crypto";
import DigitalBookOrder from "./order.model.js";
import DigitalBookPaymentEvent from "./payment-event.model.js";
import LedgerTransaction from "./ledger-transaction.model.js";
import DigitalBookEntitlement from "./book-entitlement.model.js";

function fail(message, code = "INVALID_ENTITLEMENT") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function sameId(left, right) {
  return String(left?._id ?? left?.id ?? left) === String(right?._id ?? right?.id ?? right);
}

function validatePaidLedger(order, ledger) {
  if (!ledger || ledger.eventType !== "order_payment" || ledger.sourceType !== "payment_event") {
    throw fail("A payment ledger transaction is required before granting book access.", "PAYMENT_LEDGER_REQUIRED");
  }
  if (!sameId(ledger.orderId, order._id ?? order.id) || ledger.currency !== order.currency) {
    throw fail("The payment ledger transaction does not match the paid order.");
  }
  const entries = Array.isArray(ledger.entries) ? ledger.entries : [];
  if (entries.length < 2 || entries.some((entry) =>
    !Number.isSafeInteger(entry.amountPaise)
    || entry.amountPaise < 1
    || !["debit", "credit"].includes(entry.direction)
  )) {
    throw fail("The payment ledger entries are invalid.");
  }
  const debits = entries.filter((entry) => entry.direction === "debit")
    .reduce((total, entry) => total + BigInt(entry.amountPaise), 0n);
  const credits = entries.filter((entry) => entry.direction === "credit")
    .reduce((total, entry) => total + BigInt(entry.amountPaise), 0n);
  if (
    debits !== BigInt(order.amountPaise)
    || credits !== BigInt(order.amountPaise)
    || debits !== credits
  ) {
    throw fail("The payment ledger totals must balance to the paid order amount.");
  }
}

function validateVerifiedPaymentSource(order, ledger, paymentEvent) {
  const sourceId = String(ledger.sourceId || "");
  const separator = sourceId.indexOf(":");
  if (separator < 1 || separator === sourceId.length - 1) {
    throw fail("The ledger payment source is invalid.", "VERIFIED_PAYMENT_REQUIRED");
  }
  const provider = sourceId.slice(0, separator);
  const eventId = sourceId.slice(separator + 1);
  const sourceKeyHash = createHash("sha256").update(sourceId).digest("hex");
  if (sourceKeyHash !== ledger.sourceKeyHash || !paymentEvent) {
    throw fail("The ledger must point to a persisted verified payment event.", "VERIFIED_PAYMENT_REQUIRED");
  }
  const verifiedAt = paymentEvent.signatureVerifiedAt;
  if (
    paymentEvent.provider !== provider
    || paymentEvent.eventId !== eventId
    || !sameId(paymentEvent.orderId, order._id ?? order.id)
    || paymentEvent.outcome !== "applied"
    || !Number.isSafeInteger(paymentEvent.amountPaise)
    || paymentEvent.amountPaise !== order.amountPaise
    || paymentEvent.currency !== order.currency
    || !verifiedAt
    || Number.isNaN(new Date(verifiedAt).getTime())
  ) {
    throw fail("A signature-verified payment event matching this order is required.", "VERIFIED_PAYMENT_REQUIRED");
  }
}

function matchesOrder(entitlement, order, ledger) {
  return sameId(entitlement.readerId, order.buyerId)
    && entitlement.bookId === order.bookId
    && sameId(entitlement.orderId, order._id ?? order.id)
    && sameId(entitlement.sourceLedgerId, ledger._id ?? ledger.id)
    && entitlement.amountPaise === order.amountPaise
    && entitlement.currency === order.currency;
}

export function createPaidBookEntitlementService({
  findOrderById,
  findPaymentLedgerByOrderId,
  findVerifiedPaymentEvent,
  findEntitlementByOrderId,
  findEntitlementByReaderAndBook,
  createEntitlement,
}) {
  for (const dependency of [
    findOrderById,
    findPaymentLedgerByOrderId,
    findVerifiedPaymentEvent,
    findEntitlementByOrderId,
    findEntitlementByReaderAndBook,
    createEntitlement,
  ]) {
    if (typeof dependency !== "function") throw new TypeError("Entitlement service requires authoritative database operations.");
  }

  return async function grantPaidBookEntitlement(orderId, { session } = {}) {
    if (typeof orderId !== "string" || !/^[a-f0-9]{24}$/i.test(orderId)) {
      throw fail("A valid paid order ID is required.");
    }
    const order = await findOrderById(orderId, { session });
    if (!order) throw fail("The order was not found.", "ORDER_NOT_FOUND");
    if (order.status !== "paid") throw fail("Only paid orders can grant book access.", "ORDER_NOT_PAID");
    if (
      !order.buyerId
      || typeof order.bookId !== "string"
      || !order.bookId.trim()
      || !Number.isSafeInteger(order.amountPaise)
      || order.amountPaise < 1
      || order.currency !== "INR"
    ) {
      throw fail("The paid order is missing valid book purchase details.");
    }

    const ledger = await findPaymentLedgerByOrderId(order._id ?? order.id, { session });
    validatePaidLedger(order, ledger);
    const sourceId = String(ledger.sourceId || "");
    const separator = sourceId.indexOf(":");
    const paymentEvent = separator > 0
      ? await findVerifiedPaymentEvent(sourceId.slice(0, separator), sourceId.slice(separator + 1), { session })
      : null;
    validateVerifiedPaymentSource(order, ledger, paymentEvent);

    const byOrder = await findEntitlementByOrderId(order._id ?? order.id, { session });
    if (byOrder) {
      if (!matchesOrder(byOrder, order, ledger)) {
        throw fail("An entitlement already exists with conflicting paid-order details.", "ENTITLEMENT_CONFLICT");
      }
      return { entitlement: byOrder, replayed: true, alreadyOwned: false };
    }

    const existingBook = await findEntitlementByReaderAndBook(order.buyerId, order.bookId, { session });
    if (existingBook) {
      if (!sameId(existingBook.readerId, order.buyerId) || existingBook.bookId !== order.bookId) {
        throw fail("An existing book entitlement does not match this reader.", "ENTITLEMENT_CONFLICT");
      }
      return { entitlement: existingBook, replayed: true, alreadyOwned: true };
    }

    const record = {
      readerId: order.buyerId,
      bookId: order.bookId,
      orderId: order._id ?? order.id,
      sourceLedgerId: ledger._id ?? ledger.id,
      amountPaise: order.amountPaise,
      currency: order.currency,
    };

    try {
      const entitlement = await createEntitlement(record, { session });
      return { entitlement, replayed: false, alreadyOwned: false };
    } catch (error) {
      // A duplicate write aborts an active MongoDB transaction. Let the caller retry it.
      if (error?.code !== 11000 || session?.inTransaction()) throw error;
      const racedOrder = await findEntitlementByOrderId(order._id ?? order.id);
      if (racedOrder && matchesOrder(racedOrder, order, ledger)) {
        return { entitlement: racedOrder, replayed: true, alreadyOwned: false };
      }
      const racedBook = await findEntitlementByReaderAndBook(order.buyerId, order.bookId);
      if (racedBook && sameId(racedBook.readerId, order.buyerId) && racedBook.bookId === order.bookId) {
        return { entitlement: racedBook, replayed: true, alreadyOwned: true };
      }
      throw error;
    }
  };
}

function withSession(query, session) {
  return session ? query.session(session) : query;
}

const defaultService = createPaidBookEntitlementService({
  findOrderById: (orderId, { session } = {}) => withSession(DigitalBookOrder.findById(orderId), session).lean(),
  findPaymentLedgerByOrderId: (orderId, { session } = {}) => withSession(
    LedgerTransaction.findOne({ orderId, eventType: "order_payment", sourceType: "payment_event" })
      .select("_id orderId eventType sourceType sourceId +sourceKeyHash currency entries"),
    session,
  ).lean(),
  findVerifiedPaymentEvent: (provider, eventId, { session } = {}) => withSession(
    DigitalBookPaymentEvent.findOne({ provider, eventId }).select("_id orderId provider eventId amountPaise currency outcome signatureVerifiedAt"),
    session,
  ).lean(),
  findEntitlementByOrderId: (orderId, { session } = {}) => withSession(
    DigitalBookEntitlement.findOne({ orderId }).select("+sourceLedgerId"),
    session,
  ).lean(),
  findEntitlementByReaderAndBook: (readerId, bookId, { session } = {}) => withSession(
    DigitalBookEntitlement.findOne({ readerId, bookId }),
    session,
  ).lean(),
  createEntitlement: (record, { session } = {}) => new DigitalBookEntitlement(record).save({ session }),
});

export default defaultService;
