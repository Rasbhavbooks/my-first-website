import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { planFullRefund } from "../../../../shared/commerce-pricing.js";
import Order from "./order.model.js";
import Ledger from "./ledger-transaction.model.js";

function refundError(message, code = "INVALID_FULL_REFUND") {
  return Object.assign(new Error(message), { code });
}

// Internal only. The caller must provide confirmation from a test payment provider.
export async function applyConfirmedTestRefund({ mode, orderId, confirmation }) {
  if (mode !== "test") throw refundError("Only test refunds can be applied.", "LIVE_REFUNDS_DISABLED");
  if (!mongoose.isObjectIdOrHexString(orderId) || confirmation?.status !== "completed"
    || typeof confirmation.refundId !== "string" || !/^[a-zA-Z0-9_-]{1,160}$/.test(confirmation.refundId)) {
    throw refundError("A completed test refund confirmation is required.");
  }

  return mongoose.connection.transaction(async session => {
    const order = await Order.findById(orderId).select("+paymentReference").session(session);
    if (!order || !order.paymentReference || order.paymentReference !== confirmation.paymentId
      || order.amountPaise !== confirmation.amountPaise || order.currency !== confirmation.currency) {
      throw refundError("Refund confirmation does not match the original payment.");
    }
    const sourceKeyHash = createHash("sha256").update("test-full-refund:" + order.id).digest("hex");
    const existing = await Ledger.findOne({ sourceKeyHash }).session(session).lean();
    if (order.status === "refunded" && existing?.sourceId === confirmation.refundId) {
      return { replayed: true, amountPaise: order.amountPaise };
    }
    if (order.status !== "refund_pending" || existing) {
      throw refundError("The order is not awaiting this refund.");
    }
    const receipt = await Ledger.exists({ orderId: order._id, eventType: "order_payment", currency: order.currency }).session(session);
    if (!receipt) throw refundError("The original payment ledger entry is missing.");

    const refund = planFullRefund({ ...order.toObject(), totalPaise: order.amountPaise });
    order.transitionTo("refunded");
    await order.save({ session });
    await Ledger.create([{
      eventType: "refund",
      sourceType: "refund",
      sourceId: confirmation.refundId,
      sourceKeyHash,
      orderId: order._id,
      currency: order.currency,
      entries: refund.ledgerEntries,
    }], { session });
    return { replayed: false, amountPaise: refund.refundAmountPaise };
  });
}
