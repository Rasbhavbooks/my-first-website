import mongoose from "mongoose";

const ledgerEntrySchema = new mongoose.Schema(
  {
    accountCode: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 80,
      match: /^[a-z][a-z0-9_.-]{1,79}$/,
      immutable: true,
    },
    direction: {
      type: String,
      required: true,
      enum: ["debit", "credit"],
      immutable: true,
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Ledger amounts must be whole paise values.",
      },
      immutable: true,
    },
  },
  { _id: false },
);

const ledgerTransactionSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      required: true,
      enum: [
        "order_payment",
        "book_sale",
        "platform_commission",
        "author_royalty",
        "gateway_fee",
        "refund",
        "tax",
        "payout",
        "adjustment",
      ],
      immutable: true,
    },
    sourceType: {
      type: String,
      required: true,
      enum: ["payment_event", "refund", "payout", "admin_adjustment"],
      immutable: true,
    },
    sourceId: { type: String, required: true, trim: true, maxlength: 160, immutable: true },
    sourceKeyHash: {
      type: String,
      required: true,
      match: /^[a-f0-9]{64}$/,
      select: false,
      immutable: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DigitalBookOrder",
      default: null,
      immutable: true,
    },
    currency: { type: String, enum: ["INR"], required: true, default: "INR", immutable: true },
    entries: { type: [ledgerEntrySchema], required: true, immutable: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    strict: "throw",
  },
);

ledgerTransactionSchema.pre("validate", function validateBalancedEntries() {
  const entries = Array.isArray(this.entries) ? this.entries : [];
  if (entries.length < 2 || entries.length > 20) {
    this.invalidate("entries", "A ledger transaction must contain between 2 and 20 entries.");
    return;
  }

  if (entries.some((entry) => !Number.isSafeInteger(entry.amountPaise) || entry.amountPaise < 1)) {
    return;
  }

  const debitTotal = entries
    .filter((entry) => entry.direction === "debit")
    .reduce((total, entry) => total + BigInt(entry.amountPaise), 0n);
  const creditTotal = entries
    .filter((entry) => entry.direction === "credit")
    .reduce((total, entry) => total + BigInt(entry.amountPaise), 0n);
  if (debitTotal !== creditTotal) {
    this.invalidate("entries", "Debit and credit totals must balance.");
  }
});

ledgerTransactionSchema.index({ sourceKeyHash: 1 }, { unique: true });
ledgerTransactionSchema.index({ orderId: 1, createdAt: 1 });

const LedgerTransaction = mongoose.models.LedgerTransaction
  || mongoose.model("LedgerTransaction", ledgerTransactionSchema);
export default LedgerTransaction;
