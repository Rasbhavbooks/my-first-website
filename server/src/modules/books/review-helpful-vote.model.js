import mongoose from "mongoose";

const reviewHelpfulVoteSchema = new mongoose.Schema(
  {
    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BookReview",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true, versionKey: false },
);

reviewHelpfulVoteSchema.index({ reviewId: 1, userId: 1 }, { unique: true });
reviewHelpfulVoteSchema.index({ userId: 1, createdAt: -1 });

const ReviewHelpfulVote = mongoose.models.ReviewHelpfulVote
  || mongoose.model("ReviewHelpfulVote", reviewHelpfulVoteSchema);
export default ReviewHelpfulVote;
