import { Router } from "express";
import { env } from "../../config/env.js";
import processPaymentEvent from "./payment-event-processor.js";

const router = Router();

router.post("/", async (request, response) => {
  if (!env.razorpayWebhookConfigured) {
    return response.status(503).json({ message: "Razorpay webhook is not configured." });
  }
  if (!Buffer.isBuffer(request.body)) {
    return response.status(400).json({ message: "A raw JSON webhook body is required." });
  }

  try {
    await processPaymentEvent({ rawBody: request.body, headers: request.headers });
    return response.status(200).json({ received: true });
  } catch (error) {
    if ([
      "INVALID_RAZORPAY_WEBHOOK",
      "SIGNATURE_VERIFICATION_FAILED",
      "INVALID_PAYMENT_EVENT",
      "PAYMENT_ATTEMPT_NOT_FOUND",
      "PAYMENT_PROVIDER_NOT_CONFIGURED",
    ].includes(error?.code)) {
      return response.status(error.code === "PAYMENT_PROVIDER_NOT_CONFIGURED" ? 503 : 400)
        .json({ message: "Razorpay webhook could not be verified or matched." });
    }
    return response.status(500).json({ message: "Razorpay webhook processing failed." });
  }
});

export default router;
