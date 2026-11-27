import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { planFullRefund } from "../../../../shared/commerce-pricing.js";
import PaymentAttempt from "./payment-attempt.model.js";
import Order from "./order.model.js";
import Ledger from "./ledger-transaction.model.js";

function refundError(message, code = "INVALID_FULL_REFUND") {
  return Object.assign(new Error(message), { code });
}

function requireTestMode(mode) {
  if (mode !== "test") throw refundError("Only test refunds can be applied.", "LIVE_REFUNDS_DISABLED");
}

function findOriginalAttempt(order, session) {
  return PaymentAttempt.findOne({
    orderId: order._id, provider: order.paymentProvider, providerPaymentId: order.paymentReference,
    amountPaise: order.amountPaise, currency: order.currency,
  }).session(session);
}

export async function startFullTestRefund({ mode, orderId }) {
  requireTestMode(mode);
  if (!mongoose.isObjectIdOrHexString(orderId)) throw refundError("A valid order is required.");
  return mongoose.connection.transaction(async session => {
    const order = await Order.findById(orderId).select("+paymentProvider +paymentReference").session(session);
    if (!order?.paymentReference || !order.paymentProvider || !["paid", "refund_pending"].includes(order.status)) {
      throw refundError("Only a paid order can start a full refund.");
    }
    const attempt = await findOriginalAttempt(order, session);
    if (order.status === "refund_pending" && attempt?.status === "refund_pending") {
      return { replayed: true };
    }
    if (attempt?.status !== "captured") throw refundError("The original captured payment is missing.");
    if (order.status === "paid") {
      order.transitionTo("refund_pending");
      await order.save({ session });
    }
    attempt.transitionTo("refund_pending");
    await attempt.save({ session });
    return { replayed: false };
  });
}

// Internal only. The caller must provide confirmation from a test payment provider.
export async function applyConfirmedTestRefund({ mode, orderId, confirmation }) {
  requireTestMode(mode);
  if (!mongoose.isObjectIdOrHexString(orderId) || confirmation?.status !== "completed"
    || typeof confirmation.refundId !== "string" || !/^[a-zA-Z0-9_-]{1,160}$/.test(confirmation.refundId)) {
    throw refundError("A completed test refund confirmation is required.");
  }

  return mongoose.connection.transaction(async session => {
    const order = await Order.findById(orderId).select("+paymentProvider +paymentReference").session(session);
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
    const attempt = await findOriginalAttempt(order, session);
    if (attempt?.status !== "refund_pending") throw refundError("The original payment is not awaiting a refund.");
    const receipt = await Ledger.exists({ orderId: order._id, eventType: "order_payment", currency: order.currency }).session(session);
    if (!receipt) throw refundError("The original payment ledger entry is missing.");

    const refund = planFullRefund({ ...order.toObject(), totalPaise: order.amountPaise });
    order.transitionTo("refunded");
    await order.save({ session });
    attempt.transitionTo("refunded");
    await attempt.save({ session });
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
