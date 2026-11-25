import mongoose from "mongoose";
import DigitalBookOrder from "./order.model.js";
import DigitalBookPaymentAttempt from "./payment-attempt.model.js";
import razorpayClient from "./razorpay-client.js";

function fail(message, code = "INVALID_RAZORPAY_ORDER") {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function createRazorpayOrderService({
  findAttemptById,
  findOrderById,
  createProviderOrder,
  findProviderOrderByReceipt,
  saveAttempt,
}) {
  if (
    typeof findAttemptById !== "function"
    || typeof findOrderById !== "function"
    || typeof createProviderOrder !== "function"
    || typeof findProviderOrderByReceipt !== "function"
    || typeof saveAttempt !== "function"
  ) {
    throw new TypeError("Razorpay order service requires local persistence and provider adapters.");
  }

  return async function createRazorpayOrderForAttempt({ attemptId, buyerId }) {
    if (!mongoose.isValidObjectId(attemptId) || !mongoose.isValidObjectId(buyerId)) {
      throw fail("A valid reader and local payment-attempt ID are required.");
    }

    const attempt = await findAttemptById(attemptId);
    if (!attempt || attempt.provider !== "razorpay") {
      throw fail("The Razorpay payment attempt was not found.", "PAYMENT_ATTEMPT_NOT_FOUND");
    }
    const order = await findOrderById(attempt.orderId);
    if (!order || String(order.buyerId) !== String(buyerId)) {
      throw fail("The local book order was not found for this reader.", "PAYMENT_ORDER_NOT_FOUND");
    }
    if (
      order.status !== "pending_payment"
      || !Number.isSafeInteger(order.amountPaise)
      || order.amountPaise < 1
      || order.currency !== "INR"
      || order.amountPaise !== attempt.amountPaise
      || order.currency !== attempt.currency
    ) {
      throw fail("The payment attempt does not match a payable INR order.", "INVALID_RAZORPAY_ORDER");
    }

    if (attempt.providerOrderId) {
      return { providerOrderId: attempt.providerOrderId, replayed: true };
    }
    if (!["created", "pending"].includes(attempt.status)) {
      throw fail("Only an active payment attempt can receive a Razorpay order.", "PAYMENT_ATTEMPT_NOT_ACTIVE");
    }

    const receipt = `rb-${String(attempt._id)}`;
    const input = {
      amountPaise: order.amountPaise,
      currency: order.currency,
      receipt,
      notes: {
        local_order_id: String(order._id),
        payment_attempt_id: String(attempt._id),
      },
    };

    let providerOrder = await findProviderOrderByReceipt(input);
    if (!providerOrder) {
      try {
        providerOrder = await createProviderOrder(input);
      } catch (error) {
        // Recover a response lost after Razorpay accepted the unique receipt.
        providerOrder = await findProviderOrderByReceipt(input).catch(() => null);
        if (!providerOrder) throw error;
      }
    }
    if (
      !providerOrder
      || !/^order_[A-Za-z0-9]{1,150}$/.test(String(providerOrder.id ?? ""))
      || providerOrder.amountPaise !== order.amountPaise
      || providerOrder.currency !== order.currency
      || providerOrder.receipt !== receipt
    ) {
      throw fail("Razorpay order details did not match the local order.", "RAZORPAY_ORDER_MISMATCH");
    }

    attempt.attachProviderOrderId(providerOrder.id);
    if (attempt.status === "created") attempt.transitionTo("pending");
    await saveAttempt(attempt);
    return { providerOrderId: providerOrder.id, replayed: false };
  };
}

const defaultService = createRazorpayOrderService({
  findAttemptById: (attemptId) => DigitalBookPaymentAttempt.findById(attemptId).select("+providerOrderId"),
  findOrderById: (orderId) => DigitalBookOrder.findById(orderId),
  createProviderOrder: (input) => razorpayClient.createOrder(input),
  findProviderOrderByReceipt: (input) => razorpayClient.findOrderByReceipt(input),
  saveAttempt: (attempt) => attempt.save(),
});

export default defaultService;
