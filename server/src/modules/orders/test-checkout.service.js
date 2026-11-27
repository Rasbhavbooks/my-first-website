import mongoose from "mongoose";
import createPendingBookOrder from "./order.service.js";
import createPaymentAttempt from "./payment-attempt.service.js";
import createRazorpayOrderForAttempt from "./razorpay-order.service.js";

export function createTestCheckoutService({ createGatewayOrder = createRazorpayOrderForAttempt } = {}) {
  return async function prepareTestCheckout({ mode, buyerId, bookId, idempotencyKey, referralCode }) {
    if (mode !== "test") {
      throw Object.assign(new Error("Only test checkout is supported."), { code: "LIVE_CHECKOUT_DISABLED" });
    }
    const { order, attempt } = await mongoose.connection.transaction(async session => {
      const { order } = await createPendingBookOrder({ buyerId, bookId, idempotencyKey, referralCode }, { session });
      const { attempt } = await createPaymentAttempt({
        buyerId, orderId: order._id, provider: "razorpay", idempotencyKey,
      }, { session });
      return { order, attempt };
    });
    // Keep provider calls outside the database transaction. A retry reuses the committed attempt.
    const { providerOrderId } = await createGatewayOrder({ attemptId: attempt._id, buyerId });
    return {
      orderId: String(order._id),
      attemptId: String(attempt._id),
      providerOrderId,
      amountPaise: order.amountPaise,
      currency: order.currency,
    };
  };
}

export default createTestCheckoutService();
