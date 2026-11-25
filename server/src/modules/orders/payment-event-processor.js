import mongoose from "mongoose";
import applyCapturedPayment from "./payment-application.service.js";
import postVerifiedPaymentLedger from "./ledger-writer.js";
import recordPaymentEvent from "./payment-event-recorder.js";

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
}) {
  if (
    typeof recordEvent !== "function"
    || typeof withTransaction !== "function"
    || typeof applyCapturedPayment !== "function"
    || typeof postLedger !== "function"
  ) {
    throw new TypeError("Payment event processor requires event recording, transaction, and application services.");
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
      if (result.applied && !result.replayed) {
        // Both sides record the gross receipt. Royalties and fees are separate transactions.
        const amountPaise = event.amountPaise;
        await postLedger({
          paymentEventId: eventId,
          entries: [
            { accountCode: "gateway_clearing", direction: "debit", amountPaise },
            { accountCode: "unallocated_book_receipts", direction: "credit", amountPaise },
          ],
        }, { session });
      }
      return result;
    });
    return {
      recorded: true,
      replayed: recorded.replayed === true,
      paymentApplied: application?.applied === true,
      applicationReplayed: application?.replayed === true,
    };
  };
}

const defaultProcessor = createPaymentEventProcessor({
  recordEvent: recordPaymentEvent,
  applyCapturedPayment,
  postLedger: postVerifiedPaymentLedger,
});

export default defaultProcessor;
