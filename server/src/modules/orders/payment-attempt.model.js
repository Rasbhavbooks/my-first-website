import mongoose from "mongoose";

const transitions = Object.freeze({
  created: ["pending", "captured", "failed", "cancelled"],
  pending: ["authorized", "captured", "failed", "cancelled"],
  authorized: ["captured", "failed", "cancelled"],
  captured: ["refund_pending"],
  refund_pending: ["captured", "refunded"],
  failed: [],
  cancelled: [],
  refunded: [],
});

const paymentAttemptSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "DigitalBookOrder", required: true },
    attemptNumber: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isSafeInteger, message: "Attempt number must be a whole number." },
    },
    idempotencyKeyHash: {
      type: String,
      required: true,
      match: /^[a-f0-9]{64}$/,
      select: false,
    },
    provider: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 40,
      match: /^[a-z0-9-]+$/,
    },
    providerOrderId: { type: String, trim: true, maxlength: 160, select: false },
    providerPaymentId: { type: String, trim: true, maxlength: 160, select: false },
    providerRefundId: { type: String, trim: true, maxlength: 160, select: false },
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isSafeInteger, message: "Payment amounts must be whole paise values." },
    },
    currency: { type: String, enum: ["INR"], required: true, default: "INR" },
    status: {
      type: String,
      enum: ["created", "pending", "authorized", "captured", "failed", "cancelled", "refund_pending", "refunded"],
      required: true,
      default: "created",
      index: true,
    },
    failureCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 60,
      match: /^[A-Z0-9_-]*$/,
      default: "",
    },
    capturedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false, strict: "throw" },
);

paymentAttemptSchema.index({ orderId: 1, attemptNumber: 1 }, { unique: true });
paymentAttemptSchema.index({ orderId: 1, idempotencyKeyHash: 1 }, { unique: true });
paymentAttemptSchema.index(
  { provider: 1, providerPaymentId: 1 },
  { unique: true, partialFilterExpression: { providerPaymentId: { $type: "string" } } },
);

function transitionError(message = "Payment attempt changes must use a valid status transition.") {
  const error = new Error(message);
  error.code = "INVALID_PAYMENT_TRANSITION";
  return error;
}

paymentAttemptSchema.post("init", function rememberPersistedStatus() {
  this.$locals.persistedStatus = this.status;
});

paymentAttemptSchema.pre("validate", function validateStatusTransition() {
  if (this.isNew) {
    if (this.status !== "created") this.invalidate("status", "New payment attempts must start as created.");
    return;
  }
  if (!this.isModified("status")) return;

  const originalStatus = this.$locals.persistedStatus;
  const authorized = this.$locals.transitionAuthorized === true;
  if (
    !authorized
    || this.$locals.transitionFrom !== originalStatus
    || !transitions[originalStatus]?.includes(this.status)
  ) {
    this.invalidate("status", "Use transitionTo() for a valid payment status change.");
  }
});

function rejectQueryMutation() {
  throw transitionError("Payment attempts must be changed through a validated document transition.");
}

for (const operation of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace"]) {
  paymentAttemptSchema.pre(operation, rejectQueryMutation);
}

paymentAttemptSchema.methods.transitionTo = function transitionTo(nextStatus, now = new Date()) {
  if (this.$locals.transitionAuthorized) {
    throw transitionError("Save this payment transition before changing its status again.");
  }
  const currentStatus = this.isNew ? this.status : this.$locals.persistedStatus;
  if (
    !currentStatus
    || this.status !== currentStatus
    || !transitions[currentStatus]?.includes(nextStatus)
  ) {
    throw transitionError(`Payment cannot move from ${currentStatus || this.status} to ${nextStatus}.`);
  }

  this.$locals.transitionFrom = currentStatus;
  this.$locals.transitionAuthorized = true;
  this.status = nextStatus;
  if (nextStatus === "captured") this.capturedAt = now;
  if (nextStatus === "failed") this.failedAt = now;
  if (nextStatus === "cancelled") this.cancelledAt = now;
  if (nextStatus === "refunded") this.refundedAt = now;
  return this;
};

paymentAttemptSchema.post("save", function rememberSavedStatus(document) {
  document.$locals.persistedStatus = document.status;
  document.$locals.transitionFrom = undefined;
  document.$locals.transitionAuthorized = false;
});

const DigitalBookPaymentAttempt = mongoose.models.DigitalBookPaymentAttempt
  || mongoose.model("DigitalBookPaymentAttempt", paymentAttemptSchema);
export default DigitalBookPaymentAttempt;
