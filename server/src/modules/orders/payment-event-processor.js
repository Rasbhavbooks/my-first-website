import mongoose from "mongoose";
import grantPaidBookEntitlement from "./book-entitlement.service.js";
import applyCapturedPayment from "./payment-application.service.js";
import postVerifiedPaymentLedger from "./ledger-writer.js";
import recordPaymentEvent from "./payment-event-recorder.js";
import queueDuplicatePaymentRefund from "./refund-request.service.js";

function fail(message, code = "INVALID_PAYMENT_EVENT") {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function withMongoTransaction(callback) {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => callback(session));
  } finally {
    await session.endSession();
  }
}

export function createPaymentEventProcessor({
  recordEvent,
  withTransaction = withMongoTransaction,
  applyCapturedPayment,
  postLedger,
  grantEntitlement,
  queueDuplicateRefund,
}) {
  if (
    typeof recordEvent !== "function"
    || typeof withTransaction !== "function"
    || typeof applyCapturedPayment !== "function"
    || typeof postLedger !== "function"
    || typeof grantEntitlement !== "function"
    || typeof queueDuplicateRefund !== "function"
  ) {
    throw new TypeError("Payment event processor requires event recording, transaction, capture, ledger, entitlement, and refund-queue services.");
  }

  return async function processPaymentEvent({ rawBody, headers }) {
    // Recording verifies the original bytes and saves only normalized immutable facts.
    const recorded = await recordEvent({ rawBody, headers });
    const event = recorded?.event;
    const eventId = event?._id ? String(event._id) : "";
    if (!/^[a-f0-9]{24}$/i.test(eventId)) {
      throw fail("The payment event recorder did not return a persisted event.", "PAYMENT_EVENT_NOT_PERSISTED");
    }

    if (event.outcome !== "applied" || event.eventType !== "payment.captured") {
      return {
        recorded: true,
        replayed: recorded.replayed === true,
        paymentApplied: false,
      };
    }

    const application = await withTransaction(async (session) => {
      const result = await applyCapturedPayment(eventId, { session });
      if (result.duplicatePayment === true) {
        await queueDuplicateRefund(eventId, { session });
      } else if (result.applied && !result.replayed) {
        // The writer derives the itemized author, platform, tax, gateway, and referral
        // allocations from the persisted order snapshot; callers cannot choose recipients.
        await postLedger({ paymentEventId: eventId }, { session });
        await grantEntitlement(String(event.orderId), { session });
      }
      return result;
    });
    const result = {
      recorded: true,
      replayed: recorded.replayed === true,
      paymentApplied: application?.applied === true,
      applicationReplayed: application?.replayed === true,
    };
    if (application?.duplicatePayment === true) {
      result.duplicatePayment = true;
      result.refundStatus = "pending";
    }
    return result;
  };
}

const defaultProcessor = createPaymentEventProcessor({
  recordEvent: recordPaymentEvent,
  applyCapturedPayment,
  postLedger: postVerifiedPaymentLedger,
  grantEntitlement: grantPaidBookEntitlement,
  queueDuplicateRefund: queueDuplicatePaymentRefund,
});

export default defaultProcessor;
