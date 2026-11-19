import mongoose from "mongoose";

const reviewReportSchema = new mongoose.Schema(
  {
    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BookReview",
      required: true,
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
  },
  { timestamps: true, versionKey: false },
);

reviewReportSchema.index({ reviewId: 1, reporterId: 1 }, { unique: true });

const ReviewReport = mongoose.models.ReviewReport || mongoose.model("ReviewReport", reviewReportSchema);
export default ReviewReport;
