import mongoose from "mongoose";

const localizedTitleSchema = new mongoose.Schema(
  {
    en: { type: String, required: true, trim: true, maxlength: 240 },
    gu: { type: String, required: true, trim: true, maxlength: 240 },
    hi: { type: String, required: true, trim: true, maxlength: 240 },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    idempotencyKeyHash: {
      type: String,
      required: true,
      match: /^[a-f0-9]{64}$/,
      select: false,
    },
    bookId: { type: String, required: true, trim: true, maxlength: 64 },
    bookTitle: { type: localizedTitleSchema, required: true },
    authorName: { type: String, required: true, trim: true, maxlength: 120 },
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Order amounts must be whole paise values.",
      },
    },
    currency: { type: String, enum: ["INR"], required: true, default: "INR" },
    status: {
      type: String,
      enum: ["pending_payment", "paid", "cancelled", "refund_pending", "refunded"],
      required: true,
      default: "pending_payment",
      index: true,
    },
    paymentProvider: { type: String, trim: true, lowercase: true, maxlength: 40, default: "" },
    paymentReference: { type: String, trim: true, maxlength: 160, default: "", select: false },
    paidAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

orderSchema.index({ buyerId: 1, idempotencyKeyHash: 1 }, { unique: true });
orderSchema.index({ buyerId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

const DigitalBookOrder = mongoose.models.DigitalBookOrder
  || mongoose.model("DigitalBookOrder", orderSchema);
export default DigitalBookOrder;
