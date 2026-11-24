import mongoose from "mongoose";

const entitlementSchema = new mongoose.Schema(
  {
    readerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    bookId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
      immutable: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DigitalBookOrder",
      required: true,
      immutable: true,
    },
    sourceLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerTransaction",
      required: true,
      select: false,
      immutable: true,
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Entitlement purchase amounts must be whole paise values.",
      },
      immutable: true,
    },
    currency: { type: String, enum: ["INR"], required: true, immutable: true },
    grantedAt: { type: Date, required: true, default: Date.now, immutable: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, strict: "throw" },
);

entitlementSchema.index({ orderId: 1 }, { unique: true });
entitlementSchema.index({ readerId: 1, bookId: 1 }, { unique: true });

const DigitalBookEntitlement = mongoose.models.DigitalBookEntitlement
  || mongoose.model("DigitalBookEntitlement", entitlementSchema);
export default DigitalBookEntitlement;
