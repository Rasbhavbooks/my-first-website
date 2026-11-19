import mongoose from "mongoose";

const reviewReportSchema = new mongoose.Schema(
  {
    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BookReview",
      required: true,
      index: true,
    },
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      enum: ["spam", "abuse", "irrelevant", "other"],
      required: true,
    },
    details: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "dismissed", "actioned"],
      default: "pending",
      index: true,
    },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolutionNote: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { timestamps: true, versionKey: false },
);

reviewReportSchema.index({ reviewId: 1, reporterId: 1 }, { unique: true });
reviewReportSchema.index({ status: 1, createdAt: 1 });

const ReviewReport = mongoose.models.ReviewReport || mongoose.model("ReviewReport", reviewReportSchema);
export default ReviewReport;
