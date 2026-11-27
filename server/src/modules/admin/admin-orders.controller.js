import { isDatabaseConnected } from "../../config/database.js";
import DigitalBookEntitlement from "../orders/book-entitlement.model.js";
import LedgerTransaction from "../orders/ledger-transaction.model.js";
import DigitalBookOrder from "../orders/order.model.js";

const allowedStatuses = new Set(["pending_payment", "paid", "cancelled", "refund_pending", "refunded"]);

function databaseUnavailable(response) {
  return response.status(503).json({
    error: { code: "DATABASE_UNAVAILABLE", message: "Order records are temporarily unavailable." },
  });
}

function parsePositiveInteger(value, fallback, maximum) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : null;
}

export function checkPaidOrderRecords(order, receipts, grant) {
  if (order.status !== "paid") return null;
  if (!receipts.length) return "missing_receipt";
  if (receipts.length > 1 || receipts[0].currency !== order.currency) return "inconsistent";
  if (!grant) return "missing_entitlement";
  const matches = String(grant.readerId) === String(order.buyerId)
    && grant.bookId === order.bookId
    && grant.amountPaise === order.amountPaise
    && grant.currency === order.currency
    && String(grant.sourceLedgerId) === String(receipts[0]._id);
  return matches ? "linked" : "inconsistent";
}

export function serializeAdminOrder(order, recordStatus = null) {
  return {
    id: String(order._id),
    bookId: order.bookId,
    bookTitle: {
      en: order.bookTitle?.en || "",
      gu: order.bookTitle?.gu || "",
      hi: order.bookTitle?.hi || "",
    },
    authorName: order.authorName,
    amountPaise: order.amountPaise,
    ...([order.authorPricePaise, order.platformCommissionPaise, order.referrerRewardPaise, order.gstPaise, order.gatewayFeePaise].every(Number.isSafeInteger) && {
      allocation: { author: order.authorPricePaise, platform: order.platformCommissionPaise,
        referral: order.referrerRewardPaise, gst: order.gstPaise, gateway: order.gatewayFeePaise },
    }),
    currency: order.currency,
    status: order.status,
    recordStatus,
    createdAt: order.createdAt,
    paidAt: order.paidAt || null,
    cancelledAt: order.cancelledAt || null,
    refundedAt: order.refundedAt || null,
  };
}

export async function listAdminOrders(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!isDatabaseConnected()) return databaseUnavailable(response);

  const page = parsePositiveInteger(request.query.page, 1, 100000);
  const limit = parsePositiveInteger(request.query.limit, 25, 100);
  if (!page || !limit) {
    return response.status(400).json({
      error: { code: "INVALID_PAGINATION", message: "Choose a valid order page." },
    });
  }

  const status = request.query.status;
  if (status !== undefined && (typeof status !== "string" || !allowedStatuses.has(status))) {
    return response.status(400).json({
      error: { code: "INVALID_ORDER_STATUS", message: "Choose a valid order status." },
    });
  }

  const filter = status ? { status } : {};
  const [total, orders] = await Promise.all([
    DigitalBookOrder.countDocuments(filter),
    DigitalBookOrder.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("_id buyerId bookId bookTitle authorName amountPaise authorPricePaise platformCommissionPaise referrerRewardPaise gstPaise gatewayFeePaise currency status createdAt paidAt cancelledAt refundedAt")
      .lean(),
  ]);
  const paidIds = orders.filter((order) => order.status === "paid").map((order) => order._id);
  const [receipts, grants] = paidIds.length ? await Promise.all([
    LedgerTransaction.find({ orderId: { $in: paidIds }, eventType: "order_payment", sourceType: "payment_event" })
      .select("_id orderId currency").lean(),
    DigitalBookEntitlement.find({ orderId: { $in: paidIds } })
      .select("orderId readerId bookId amountPaise currency +sourceLedgerId").lean(),
  ]) : [[], []];
  const receiptsByOrder = new Map();
  for (const receipt of receipts) {
    const id = String(receipt.orderId);
    const rows = receiptsByOrder.get(id) ?? [];
    rows.push(receipt);
    receiptsByOrder.set(id, rows);
  }
  const grantByOrder = new Map(grants.map((grant) => [String(grant.orderId), grant]));
  return response.json({
    data: {
      orders: orders.map((order) => {
        const id = String(order._id);
        const recordStatus = checkPaidOrderRecords(order, receiptsByOrder.get(id) ?? [], grantByOrder.get(id));
        return serializeAdminOrder(order, recordStatus);
      }),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      status: status || "all",
    },
  });
}
