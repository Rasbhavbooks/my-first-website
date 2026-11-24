import { createHash } from "node:crypto";
import DigitalBookOrder from "./order.model.js";
import DigitalBookPaymentEvent from "./payment-event.model.js";
import LedgerTransaction from "./ledger-transaction.model.js";

function fail(message, code = "INVALID_LEDGER_INPUT") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function canonicalEntries(entries) {
  if (!Array.isArray(entries)) throw fail("Ledger entries must be an array.");
  return entries.map((entry) => ({
    accountCode: String(entry.accountCode ?? "").trim().toLowerCase(),
    direction: String(entry.direction ?? ""),
    amountPaise: entry.amountPaise,
  })).sort((left, right) =>
    left.accountCode.localeCompare(right.accountCode)
      || left.direction.localeCompare(right.direction)
      || left.amountPaise - right.amountPaise,
  );
}

function canonicalPayload(payload) {
  return JSON.stringify({
    eventType: payload.eventType,
    sourceType: payload.sourceType,
    sourceId: payload.sourceId,
    orderId: String(payload.orderId),
    currency: payload.currency,
    entries: canonicalEntries(payload.entries),
  });
}

function isSamePayload(existing, payload) {
  return canonicalPayload(existing) === canonicalPayload(payload);
}

function ledgerTotal(entries, direction) {
  return entries
    .filter((entry) => entry.direction === direction)
    .reduce((total, entry) => total + BigInt(entry.amountPaise), 0n);
}

export function createLedgerWriter({ createRecord, findBySourceKeyHash, findPaymentEventById, findOrderById }) {
  if (
    typeof createRecord !== "function"
    || typeof findBySourceKeyHash !== "function"
    || typeof findPaymentEventById !== "function"
    || typeof findOrderById !== "function"
  ) {
    throw new TypeError("Ledger writer requires record creation and authoritative payment-event, order, and source-key lookups.");
  }

  return async function postVerifiedPaymentLedger({ paymentEventId, entries }, { session } = {}) {
    if (typeof paymentEventId !== "string" || !/^[a-f0-9]{24}$/i.test(paymentEventId)) {
      throw fail("A persisted payment event ID is required.");
    }

    // Always load authoritative records; callers cannot supply verification, amount, or order fields.
    const paymentEvent = await findPaymentEventById(paymentEventId, { session });
    if (!paymentEvent) throw fail("The payment event was not found.", "PAYMENT_EVENT_NOT_FOUND");

    const provider = String(paymentEvent.provider ?? "").trim().toLowerCase();
    const eventId = String(paymentEvent.eventId ?? "").trim();
    const verifiedAt = paymentEvent.signatureVerifiedAt;
    if (!provider || !eventId || !verifiedAt || Number.isNaN(new Date(verifiedAt).getTime())) {
      throw fail("A signature-verified payment event is required.");
    }
    if (paymentEvent.outcome !== "applied") {
      throw fail("Only applied payment events can be posted to the ledger.");
    }
    if (!paymentEvent.orderId) throw fail("The payment event must belong to an order.");
    if (!Number.isSafeInteger(paymentEvent.amountPaise) || paymentEvent.amountPaise < 1) {
      throw fail("The verified payment amount must be a positive whole-paise value.");
    }

    const order = await findOrderById(paymentEvent.orderId, { session });
    if (!order) throw fail("The payment event order was not found.", "PAYMENT_ORDER_NOT_FOUND");
    if (order.status !== "paid") throw fail("Only paid orders can be posted to the ledger.");
    if (
      order.amountPaise !== paymentEvent.amountPaise
      || order.currency !== paymentEvent.currency
      || paymentEvent.currency !== "INR"
    ) {
      throw fail("The verified payment amount and currency must match the paid order.");
    }

    const normalizedEntries = canonicalEntries(entries);
    const totalDebits = ledgerTotal(normalizedEntries, "debit");
    const totalCredits = ledgerTotal(normalizedEntries, "credit");
    if (totalDebits !== BigInt(order.amountPaise) || totalCredits !== BigInt(order.amountPaise)) {
      throw fail("Ledger debit and credit totals must equal the paid order amount.");
    }

    const sourceId = `${provider}:${eventId}`;
    const sourceKeyHash = createHash("sha256").update(sourceId).digest("hex");
    const payload = {
      eventType: "order_payment",
      sourceType: "payment_event",
      sourceId,
      sourceKeyHash,
      orderId: order._id ?? order.id,
      currency: order.currency,
      entries: normalizedEntries,
    };

    const existing = await findBySourceKeyHash(sourceKeyHash, { session });
    if (existing) {
      if (!isSamePayload(existing, payload)) {
        throw fail("This payment event was already posted with different ledger details.", "IDEMPOTENCY_KEY_REUSED");
      }
      return { transaction: existing, replayed: true };
    }

    try {
      const transaction = await createRecord(payload, { session });
      return { transaction, replayed: false };
    } catch (error) {
      if (error?.code !== 11000) throw error;
      const racedRecord = await findBySourceKeyHash(sourceKeyHash, { session });
      if (!racedRecord) throw error;
      if (!isSamePayload(racedRecord, payload)) {
        throw fail("This payment event was already posted with different ledger details.", "IDEMPOTENCY_KEY_REUSED");
      }
      return { transaction: racedRecord, replayed: true };
    }
  };
}

const defaultWriter = createLedgerWriter({
  createRecord: (payload, { session } = {}) => new LedgerTransaction(payload).save({ session }),
  findBySourceKeyHash: (sourceKeyHash, { session } = {}) => {
    let query = LedgerTransaction.findOne({ sourceKeyHash }).select("+sourceKeyHash");
    if (session) query = query.session(session);
    return query.lean();
  },
  findPaymentEventById: (paymentEventId, { session } = {}) => {
    let query = DigitalBookPaymentEvent.findById(paymentEventId);
    if (session) query = query.session(session);
    return query.lean();
  },
  findOrderById: (orderId, { session } = {}) => {
    let query = DigitalBookOrder.findById(orderId);
    if (session) query = query.session(session);
    return query.lean();
  },
});

export default defaultWriter;
