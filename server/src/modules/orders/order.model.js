import mongoose from "mongoose";

const orderTransitions = Object.freeze({
  pending_payment: ["paid", "cancelled"],
  paid: ["refund_pending"],
  refund_pending: ["paid", "refunded"],
  cancelled: [],
  refunded: [],
});

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
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    idempotencyKeyHash: {
      type: String,
      required: true,
      match: /^[a-f0-9]{64}$/,
      select: false,
    },
    bookId: { type: String, required: true, trim: true, maxlength: 64, immutable: true },
    bookTitle: { type: localizedTitleSchema, required: true, immutable: true },
    authorName: { type: String, required: true, trim: true, maxlength: 120, immutable: true },
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Order amounts must be whole paise values.",
      },
    },
    currency: { type: String, enum: ["INR"], required: true, default: "INR", immutable: true },
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
    cancelledAt: { type: Date, default: null },\n    refundedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

function orderTransitionError(message) {
  const error = new Error(message);
  error.code = "INVALID_ORDER_TRANSITION";
  return error;
}

orderSchema.post("init", function rememberPersistedStatus() {
  this.$locals.persistedStatus = this.status;
});

orderSchema.pre("validate", function validateOrderTransition() {
  if (this.isNew) {
    if (this.status !== "pending_payment") {
      this.invalidate("status", "New orders must start as pending payment.");
    }
    return;
  }
  if (!this.isModified("status")) return;

  const originalStatus = this.$locals.persistedStatus;
  if (
    this.$locals.transitionAuthorized !== true
    || this.$locals.transitionFrom !== originalStatus
    || !orderTransitions[originalStatus]?.includes(this.status)
  ) {
    this.invalidate("status", "Use transitionTo() for a valid order status change.");
  }
});

function rejectOrderQueryMutation() {
  throw orderTransitionError("Orders must be changed through a validated document transition.");
}

for (const operation of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace"]) {
  orderSchema.pre(operation, rejectOrderQueryMutation);
}

orderSchema.methods.transitionTo = function transitionTo(nextStatus, {
  now = new Date(),
  paymentProvider,
  paymentReference,
} = {}) {
  if (this.$locals.transitionAuthorized) {
    throw orderTransitionError("Save this order transition before changing its status again.");
  }

  const currentStatus = this.isNew ? this.status : this.$locals.persistedStatus;
  if (
    !currentStatus
    || this.status !== currentStatus
    || !orderTransitions[currentStatus]?.includes(nextStatus)
  ) {
    throw orderTransitionError(`Order cannot move from ${currentStatus || this.status} to ${nextStatus}.`);
  }

  if (nextStatus === "paid" && currentStatus === "pending_payment") {
    const provider = String(paymentProvider || "").trim().toLowerCase();
    const reference = String(paymentReference || "").trim();
    if (!/^[a-z0-9-]{1,40}$/.test(provider) || !reference || reference.length > 160) {
      throw orderTransitionError("A paid order requires a valid provider and private payment reference.");
    }
    this.paymentProvider = provider;
    this.paymentReference = reference;
    if (!this.paidAt) this.paidAt = now;
  } else if (nextStatus === "paid" && !this.paidAt) {
    this.paidAt = now;
  }

  this.$locals.transitionFrom = currentStatus;
  this.$locals.transitionAuthorized = true;
  this.status = nextStatus;
  if (nextStatus === "cancelled") this.cancelledAt = now;
  if (nextStatus === "refunded") this.refundedAt = now;
  return this;
};

orderSchema.post("save", function rememberSavedStatus(document) {
  document.$locals.persistedStatus = document.status;
  document.$locals.transitionFrom = undefined;
  document.$locals.transitionAuthorized = false;
});

orderSchema.index({ buyerId: 1, idempotencyKeyHash: 1 }, { unique: true });
orderSchema.index({ buyerId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

const DigitalBookOrder = mongoose.models.DigitalBookOrder
  || mongoose.model("DigitalBookOrder", orderSchema);
export default DigitalBookOrder;
