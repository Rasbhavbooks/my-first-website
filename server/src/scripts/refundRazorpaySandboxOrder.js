import "dotenv/config";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import mongoose from "mongoose";
import Order from "../modules/orders/order.model.js";
import Ledger from "../modules/orders/ledger-transaction.model.js";
import RefundRequest from "../modules/orders/refund-request.model.js";
import razorpay from "../modules/orders/razorpay-client.js";
import { createRefundSubmissionService } from "../modules/orders/refund-submission.service.js";
import { startFullTestRefund, applyConfirmedTestRefund } from "../modules/orders/full-refund.service.js";
import { sandboxCatalogueId, withRazorpaySandbox } from "./razorpay-sandbox.js";

async function refundDuplicate(order, refundRequestId) {
  const submit = createRefundSubmissionService({
    mode: "test",
    findRefundRequestById: async id => {
      const request = await RefundRequest.findOne({
        _id: id, orderId: order._id, reason: "duplicate_payment", provider: "razorpay",
        amountPaise: order.amountPaise, currency: order.currency,
        providerPaymentId: { $ne: order.paymentReference },
      }).select("+providerPaymentId");
      return request;
    },
    refundCapturedPayment: razorpay.refundCapturedPayment,
  });
  const result = await submit(refundRequestId);
  return { ...result, status: result.completed ? "completed" : result.status };
}

async function refundOriginal(order) {
  const sourceKeyHash = createHash("sha256").update("test-full-refund:" + order.id).digest("hex");
  if (order.status === "refunded" && await Ledger.exists({ sourceKeyHash, orderId: order._id })) {
    return { status: "completed", replayed: true, amountPaise: order.amountPaise };
  }
  if (!await Ledger.exists({ orderId: order._id, eventType: "order_payment", currency: order.currency })) {
    throw new Error("The original payment ledger entry is missing.");
  }
  await startFullTestRefund({ mode: "test", orderId: order.id });
  const confirmation = await razorpay.refundCapturedPayment({
    paymentId: order.paymentReference, amountPaise: order.amountPaise, currency: order.currency,
    idempotencyKey: sourceKeyHash,
  });
  if (confirmation.status === "pending") return { status: "submitted", amountPaise: order.amountPaise };
  const result = await applyConfirmedTestRefund({ mode: "test", orderId: order.id, confirmation });
  return { ...result, status: "completed" };
}

async function run() {
  const { values } = parseArgs({
    options: {
      "test-database": { type: "string" },
      "order-id": { type: "string" },
      "duplicate-request-id": { type: "string" },
      full: { type: "boolean" },
    },
  });
  const database = values["test-database"]?.trim();
  const orderId = values["order-id"];
  const duplicateRequestId = values["duplicate-request-id"];
  if (!database || !mongoose.isObjectIdOrHexString(orderId)
    || Boolean(values.full) === (duplicateRequestId !== undefined)
    || (!values.full && !mongoose.isObjectIdOrHexString(duplicateRequestId))) {
    throw new Error("Provide --test-database, --order-id, and exactly one of --full or --duplicate-request-id.");
  }

  await withRazorpaySandbox(database, async () => {
    const order = await Order.findOne({ _id: orderId, bookId: sandboxCatalogueId, paymentProvider: "razorpay" })
      .select("+paymentReference");
    if (!order?.paymentReference) throw new Error("No captured Razorpay sandbox order matches this ID.");
    const result = values.full ? await refundOriginal(order) : await refundDuplicate(order, duplicateRequestId);
    console.info(JSON.stringify({ orderId, reason: values.full ? "full_refund" : "duplicate_payment", ...result }, null, 2));
  });
}

run().catch((error) => {
  const message = error.name === "Error" && error.code === undefined
    ? error.message
    : String(error.code ?? error.name);
  console.error("Razorpay sandbox refund failed.", message);
  process.exitCode = 1;
});
