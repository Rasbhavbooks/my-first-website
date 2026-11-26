import { createHash } from "node:crypto";

function fail(message, code = "INVALID_REFUND_SUBMISSION") {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function createRefundSubmissionService({ mode, findRefundRequestById, refundCapturedPayment }) {
  if (mode !== "test") throw fail("Refund submission is disabled outside test mode.", "LIVE_REFUNDS_DISABLED");
  if (typeof findRefundRequestById !== "function" || typeof refundCapturedPayment !== "function") {
    throw new TypeError("Test refund submission requires request lookup and an injected test provider.");
  }

  return async function submitRefundRequest(refundRequestId, { now = new Date() } = {}) {
    if (typeof refundRequestId !== "string" || !/^[a-f0-9]{24}$/i.test(refundRequestId)) {
      throw fail("A persisted refund request ID is required.");
    }
    const request = await findRefundRequestById(refundRequestId);
    if (!request) throw fail("The refund request was not found.", "REFUND_REQUEST_NOT_FOUND");
    if (request.reason !== "duplicate_payment") {
      throw fail("This test processor only submits duplicate-payment refunds.", "UNSUPPORTED_REFUND_REASON");
    }
    if (request.status === "completed") return { completed: true, replayed: true };
    if (!["pending", "submitted", "failed"].includes(request.status)) {
      throw fail("This refund request cannot be submitted from its current state.");
    }
    if (request.status !== "submitted") {
      request.transitionTo(request.status === "failed" ? "pending" : "submitted", { now });
      await request.save();
      if (request.status === "pending") {
        request.transitionTo("submitted", { now });
        await request.save();
      }
    }

    const idempotencyKey = createHash("sha256")
      .update(`rasbhav-test-refund:${refundRequestId}`)
      .digest("hex");
    let providerResult;
    try {
      providerResult = await refundCapturedPayment({
        paymentId: request.providerPaymentId,
        amountPaise: request.amountPaise,
        currency: request.currency,
        idempotencyKey,
      });
    } catch (cause) {
      // Keep the request submitted; a retry uses the same idempotency key.
      throw cause;
    }
    if (providerResult?.status === "completed" && typeof providerResult.refundId === "string") {
      request.transitionTo("completed", { now, providerRefundId: providerResult.refundId });
      await request.save();
      return { completed: true, replayed: false, amountPaise: request.amountPaise };
    }
    return { completed: false, replayed: false, status: "submitted" };
  };
}
