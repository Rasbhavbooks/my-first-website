import { isDatabaseConnected } from "../../config/database.js";
import LedgerTransaction from "../orders/ledger-transaction.model.js";

function databaseUnavailable(response) {
  return response.status(503).json({
    error: { code: "DATABASE_UNAVAILABLE", message: "The financial ledger is temporarily unavailable." },
  });
}

function parsePositiveInteger(value, fallback, maximum) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : null;
}

export function serializeLedgerTransaction(transaction) {
  return {
    id: String(transaction._id),
    occurredAt: transaction.createdAt,
    eventType: transaction.eventType,
    orderId: transaction.orderId ? String(transaction.orderId) : null,
    currency: transaction.currency,
    entries: (transaction.entries || []).map((entry) => ({
      accountCode: entry.accountCode,
      direction: entry.direction,
      amountPaise: entry.amountPaise,
    })),
  };
}

export async function listAdminLedgerTransactions(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!isDatabaseConnected()) return databaseUnavailable(response);
  const page = parsePositiveInteger(request.query.page, 1, 100000);
  const limit = parsePositiveInteger(request.query.limit, 25, 100);
  if (!page || !limit) {
    return response.status(400).json({
      error: { code: "INVALID_PAGINATION", message: "Choose a valid financial ledger page." },
    });
  }

  const [total, transactions] = await Promise.all([
    LedgerTransaction.countDocuments(),
    LedgerTransaction.find()
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("_id createdAt eventType orderId currency entries")
      .lean(),
  ]);
  return response.json({
    data: {
      transactions: transactions.map(serializeLedgerTransaction),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}
