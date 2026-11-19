import mongoose from "mongoose";

const bookReviewSchema = new mongoose.Schema(
  {
    catalogueId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: Number.isInteger,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 2000,
    },
  },
  { timestamps: true, versionKey: false },
);

bookReviewSchema.index({ catalogueId: 1, userId: 1 }, { unique: true });
bookReviewSchema.index({ catalogueId: 1, createdAt: -1 });

const BookReview = mongoose.models.BookReview || mongoose.model("BookReview", bookReviewSchema);
export default BookReview;
