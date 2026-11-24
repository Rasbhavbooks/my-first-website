import mongoose from "mongoose";

const paymentEventSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "DigitalBookOrder", required: true },
    provider: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 40,
      match: /^[a-z0-9-]+$/,
    },
    eventId: { type: String, required: true, trim: true, maxlength: 160 },
    eventType: { type: String, required: true, trim: true, maxlength: 100 },
    providerPaymentId: { type: String, trim: true, maxlength: 160, default: "", select: false },
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Payment amounts must be whole paise values.",
      },
    },
    currency: { type: String, enum: ["INR"], required: true, default: "INR" },
    signatureVerifiedAt: { type: Date, required: true },
    processedAt: { type: Date, default: Date.now },
    outcome: { type: String, enum: ["applied", "ignored"], required: true },
  },
  { timestamps: true, versionKey: false },
);

// The raw webhook body, signature, card details, and secrets are never stored.
paymentEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
paymentEventSchema.index({ orderId: 1, createdAt: -1 });

const DigitalBookPaymentEvent = mongoose.models.DigitalBookPaymentEvent
  || mongoose.model("DigitalBookPaymentEvent", paymentEventSchema);
export default DigitalBookPaymentEvent;
