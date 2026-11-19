import mongoose from "mongoose";

const readerWishlistItemSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    catalogueId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
    },
  },
  { timestamps: true, versionKey: false },
);

readerWishlistItemSchema.index({ userId: 1, catalogueId: 1 }, { unique: true });

const ReaderWishlistItem = mongoose.models.ReaderWishlistItem
  || mongoose.model("ReaderWishlistItem", readerWishlistItemSchema);
export default ReaderWishlistItem;
