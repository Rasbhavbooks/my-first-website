import { isDatabaseConnected } from "../../config/database.js";
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

export function serializeAdminOrder(order) {
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
    currency: order.currency,
    status: order.status,
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
      .select("_id bookId bookTitle authorName amountPaise currency status createdAt paidAt cancelledAt refundedAt")
      .lean(),
  ]);
  return response.json({
    data: {
      orders: orders.map(serializeAdminOrder),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      status: status || "all",
    },
  });
}
