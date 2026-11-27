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
      immutable: true,
    },
    bookId: { type: String, required: true, trim: true, maxlength: 64, immutable: true },
    bookTitle: { type: localizedTitleSchema, required: true, immutable: true },
    authorBeneficiaryId: { type: mongoose.Schema.Types.ObjectId, ref: "User", immutable: true, select: false },
    authorName: { type: String, required: true, trim: true, maxlength: 120, immutable: true },
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Order amounts must be whole paise values.",
      },
      immutable: true,
    },
    authorPricePaise: { type: Number, min: 0, validate: Number.isSafeInteger, immutable: true },
    commissionRateBps: { type: Number, min: 0, max: 10000, validate: Number.isSafeInteger, immutable: true },
    platformCommissionPaise: { type: Number, min: 0, validate: Number.isSafeInteger, immutable: true },
    referralRateBps: { type: Number, min: 0, max: 10000, validate: Number.isSafeInteger, immutable: true },
    referrerRewardPaise: { type: Number, min: 0, validate: Number.isSafeInteger, immutable: true },
    referrerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, select: false, immutable: true },
    gstRateBps: { type: Number, min: 0, max: 10000, validate: Number.isSafeInteger, immutable: true },
    gstPaise: { type: Number, min: 0, validate: Number.isSafeInteger, immutable: true },
    gatewayRateBps: { type: Number, min: 0, max: 5000, validate: Number.isSafeInteger, immutable: true },
    gatewayFeePaise: { type: Number, min: 0, validate: Number.isSafeInteger, immutable: true },
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
    cancelledAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
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
    if (
      this.status !== "pending_payment"
      || this.paymentProvider
      || this.paymentReference
      || this.paidAt
      || this.cancelledAt
      || this.refundedAt
    ) {
      this.invalidate("status", "New orders must start as pending payment without payment or lifecycle metadata.");
    }
    if (this.authorPricePaise !== undefined) {
      const quoteValues = [
        this.authorPricePaise,
        this.platformCommissionPaise,
        this.referrerRewardPaise,
        this.gstPaise,
        this.gatewayFeePaise,
      ];
      if (quoteValues.some((value) => !Number.isSafeInteger(value) || value < 0)
        || !Number.isSafeInteger(this.amountPaise)
        || BigInt(this.authorPricePaise) + BigInt(this.platformCommissionPaise)
          + BigInt(this.referrerRewardPaise) + BigInt(this.gstPaise) + BigInt(this.gatewayFeePaise)
          !== BigInt(this.amountPaise)) {
        this.invalidate("amountPaise", "The customer amount must equal the immutable pricing and allocation snapshot.");
      }
      if ((this.referrerRewardPaise > 0) !== Boolean(this.referrerId)) {
        this.invalidate("referrerId", "A referral payout requires a private referral beneficiary.");
      }
    }
    return;
  }
  const originalStatus = this.$locals.persistedStatus;
  const authorized = this.$locals.transitionAuthorized === true;
  const transitionFrom = this.$locals.transitionFrom;
  const validPaymentMetadataChange = authorized
    && transitionFrom === "pending_payment"
    && this.status === "paid";
  const validPaidTimestampChange = authorized
    && ["pending_payment", "refund_pending"].includes(transitionFrom)
    && this.status === "paid";
  const validCancelTimestampChange = authorized
    && transitionFrom === "pending_payment"
    && this.status === "cancelled";
  const validRefundTimestampChange = authorized
    && transitionFrom === "refund_pending"
    && this.status === "refunded";
  if (
    (this.isModified("paymentProvider") || this.isModified("paymentReference"))
      && !validPaymentMetadataChange
    || this.isModified("paidAt") && !validPaidTimestampChange
    || this.isModified("cancelledAt") && !validCancelTimestampChange
    || this.isModified("refundedAt") && !validRefundTimestampChange
  ) {
    this.invalidate("status", "Order payment metadata and lifecycle timestamps must change through a valid transition.");
  }
  if (!this.isModified("status")) return;
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
orderSchema.index({ referrerId: 1, status: 1 }, { partialFilterExpression: { referrerId: { $type: "objectId" } } });
orderSchema.index({ authorBeneficiaryId: 1, status: 1 }, {
  partialFilterExpression: { authorBeneficiaryId: { $type: "objectId" } },
});
orderSchema.index({ status: 1, createdAt: -1 });

const DigitalBookOrder = mongoose.models.DigitalBookOrder
  || mongoose.model("DigitalBookOrder", orderSchema);
export default DigitalBookOrder;
