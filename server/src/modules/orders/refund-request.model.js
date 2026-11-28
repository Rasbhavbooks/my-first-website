import mongoose from "mongoose";

const transitions = Object.freeze({
  pending: ["submitted", "failed"],
  submitted: ["completed", "failed"],
  completed: [],
  failed: ["pending"],
});

const refundRequestSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "DigitalBookOrder", required: true, immutable: true },
  paymentAttemptId: { type: mongoose.Schema.Types.ObjectId, ref: "DigitalBookPaymentAttempt", required: true, immutable: true },
  sourcePaymentEventId: { type: mongoose.Schema.Types.ObjectId, ref: "DigitalBookPaymentEvent", required: true, immutable: true },
  provider: { type: String, required: true, trim: true, lowercase: true, maxlength: 40, match: /^[a-z0-9-]+$/, immutable: true },
  providerPaymentId: { type: String, required: true, trim: true, maxlength: 160, select: false, immutable: true },
  providerRefundId: { type: String, trim: true, maxlength: 160, default: "", select: false },
  reason: { type: String, required: true, enum: ["duplicate_payment", "full_refund"], immutable: true },
  amountPaise: {
    type: Number,
    required: true,
    min: 1,
    validate: { validator: Number.isSafeInteger, message: "Refund amounts must be whole paise values." },
    immutable: true,
  },
  currency: { type: String, enum: ["INR"], required: true, default: function () { return this.isNew ? "INR" : undefined; }, immutable: true },
  status: { type: String, enum: ["pending", "submitted", "completed", "failed"], default: "pending", required: true },
  requestedAt: { type: Date, required: true, default: function () { return this.isNew ? new Date() : undefined; }, immutable: true },
  completedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false, strict: "throw" });

refundRequestSchema.index({ sourcePaymentEventId: 1 }, { unique: true });
refundRequestSchema.index({ orderId: 1, createdAt: -1 });
refundRequestSchema.index({ status: 1, createdAt: 1 });

function transitionError(message) {
  const error = new Error(message);
  error.code = "INVALID_REFUND_TRANSITION";
  return error;
}
refundRequestSchema.post("init", function rememberStatus() { this.$locals.persistedStatus = this.status; });
refundRequestSchema.pre("validate", function validateTransition() {
  if (this.isNew) {
    if (this.status !== "pending") this.invalidate("status", "New refund requests must start pending.");
    return;
  }
  if (!this.isModified("status")) return;
  const from = this.$locals.persistedStatus;
  if (this.$locals.transitionAuthorized !== true || !transitions[from]?.includes(this.status)) {
    this.invalidate("status", "Use transitionTo() for a valid refund request state change.");
  }
  if (this.isModified("providerRefundId") && !this.$locals.providerRefundIdAuthorized) {
    this.invalidate("providerRefundId", "Provider refund references must be attached through transitionTo().");
  }
  if (this.isModified("completedAt") && !(this.$locals.transitionAuthorized && this.status === "completed")) {
    this.invalidate("completedAt", "Refund completion time must be set by transitionTo().");
  }
});
for (const operation of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace"]) {
  refundRequestSchema.pre(operation, function rejectMutation() {
    throw transitionError("Refund requests must be changed through a validated document transition.");
  });
}
refundRequestSchema.methods.transitionTo = function transitionTo(nextStatus, { now = new Date(), providerRefundId } = {}) {
  if (this.$locals.transitionAuthorized) throw transitionError("Save this refund transition before changing its status again.");
  const from = this.isNew ? this.status : this.$locals.persistedStatus;
  if (!transitions[from]?.includes(nextStatus)) throw transitionError(`Refund request cannot move from ${from} to ${nextStatus}.`);
  if (nextStatus === "completed") {
    const id = String(providerRefundId ?? this.providerRefundId ?? "").trim();
    if (!id || id.length > 160) throw transitionError("A provider refund reference is required to complete a refund.");
    this.$locals.providerRefundIdAuthorized = true;
    this.providerRefundId = id;
    this.completedAt = now;
  }
  this.$locals.transitionAuthorized = true;
  this.status = nextStatus;
  return this;
};
refundRequestSchema.pre("save", function guardConcurrentTransition() {
  if (!this.isNew && this.isModified("status")) {
    this.$where = { status: this.$locals.persistedStatus };
  }
});
refundRequestSchema.post("save", function rememberSavedStatus(document) {
  document.$where = undefined;
  document.$locals.persistedStatus = document.status;
  document.$locals.transitionAuthorized = false;
  document.$locals.providerRefundIdAuthorized = false;
});

const PaymentRefundRequest = mongoose.models.PaymentRefundRequest
  || mongoose.model("PaymentRefundRequest", refundRequestSchema);
export default PaymentRefundRequest;
