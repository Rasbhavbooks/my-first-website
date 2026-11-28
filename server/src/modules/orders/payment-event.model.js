import mongoose from "mongoose";

const paymentEventSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "DigitalBookOrder", required: true, immutable: true },
    paymentAttemptId: { type: mongoose.Schema.Types.ObjectId, ref: "DigitalBookPaymentAttempt", required: true, immutable: true },
    provider: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 40,
      match: /^[a-z0-9-]+$/,
      immutable: true,
    },
    eventId: { type: String, required: true, trim: true, maxlength: 160, immutable: true },
    eventType: { type: String, required: true, trim: true, maxlength: 100, immutable: true },
    providerOrderId: { type: String, required: true, trim: true, maxlength: 160, select: false, immutable: true },
    providerPaymentId: { type: String, trim: true, maxlength: 160, default: "", select: false, immutable: true },
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Payment amounts must be whole paise values.",
      },
      immutable: true,
    },
    currency: { type: String, enum: ["INR"], required: true, default: "INR", immutable: true },
    signatureVerifiedAt: { type: Date, required: true, immutable: true },
    processedAt: { type: Date, default: Date.now },
    outcome: { type: String, enum: ["applied", "failed", "ignored"], required: true },
  },
  { timestamps: true, versionKey: false },
);

// Provider-signed facts are immutable after insert. Only internal processing fields may change.
// The raw webhook body, signature, card details, and secrets are never stored.
paymentEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
paymentEventSchema.index({ orderId: 1, createdAt: -1 });

const DigitalBookPaymentEvent = mongoose.models.DigitalBookPaymentEvent
  || mongoose.model("DigitalBookPaymentEvent", paymentEventSchema);
export default DigitalBookPaymentEvent;
