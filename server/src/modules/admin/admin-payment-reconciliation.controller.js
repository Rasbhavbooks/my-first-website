import { createHash } from "node:crypto";
import { isDatabaseConnected } from "../../config/database.js";
import DigitalBookPaymentEvent from "../orders/payment-event.model.js";
import LedgerTransaction from "../orders/ledger-transaction.model.js";

function databaseUnavailable(response) {
  return response.status(503).json({
    error: { code: "DATABASE_UNAVAILABLE", message: "Payment reconciliation is temporarily unavailable." },
  });
}

function parsePositiveInteger(value, fallback, maximum) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : null;
}

export function paymentEventSourceKeyHash(provider, eventId) {
  return createHash("sha256")
    .update(`${String(provider || "").trim().toLowerCase()}:${String(eventId || "").trim()}`)
    .digest("hex");
}

export function serializeReconciliationEvent(event, postedSourceKeyHashes = new Set()) {
  const posted = postedSourceKeyHashes.has(paymentEventSourceKeyHash(event.provider, event.eventId));
  const status = posted ? "posted" : event.outcome === "ignored" ? "ignored" : "unposted";
  return {
    id: String(event._id),
    orderId: event.orderId ? String(event.orderId) : null,
    eventType: event.eventType,
    amountPaise: event.amountPaise,
    currency: event.currency,
    status,
    verifiedAt: event.signatureVerifiedAt,
    processedAt: event.processedAt,
    occurredAt: event.createdAt,
  };
}

export async function listAdminPaymentReconciliation(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!isDatabaseConnected()) return databaseUnavailable(response);

  const page = parsePositiveInteger(request.query.page, 1, 100000);
  const limit = parsePositiveInteger(request.query.limit, 25, 100);
  if (!page || !limit) {
    return response.status(400).json({
      error: { code: "INVALID_PAGINATION", message: "Choose a valid reconciliation page." },
    });
  }

  const [total, events] = await Promise.all([
    DigitalBookPaymentEvent.countDocuments(),
    DigitalBookPaymentEvent.find()
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("_id provider eventId eventType orderId amountPaise currency outcome signatureVerifiedAt processedAt createdAt")
      .lean(),
  ]);
  const sourceKeyHashes = events.map((event) => paymentEventSourceKeyHash(event.provider, event.eventId));
  const postedTransactions = sourceKeyHashes.length
    ? await LedgerTransaction.find({ sourceKeyHash: { $in: sourceKeyHashes }, eventType: "order_payment" })
      .select("sourceKeyHash")
      .lean()
    : [];
  const postedSourceKeyHashes = new Set(postedTransactions.map((transaction) => transaction.sourceKeyHash));

  return response.json({
    data: {
      events: events.map((event) => serializeReconciliationEvent(event, postedSourceKeyHashes)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}
