import mongoose from "mongoose";

const readerBookmarkSchema = new mongoose.Schema({
  readerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  bookId: { type: String, required: true, trim: true, minlength: 1, maxlength: 64, immutable: true },
  pageNumber: { type: Number, required: true, min: 1, max: 100000, validate: Number.isSafeInteger },
  note: { type: String, trim: true, maxlength: 160, default: "" },
}, { timestamps: true, versionKey: false });

readerBookmarkSchema.index({ readerId: 1, bookId: 1 }, { unique: true });

export default mongoose.models.ReaderBookBookmark
  || mongoose.model("ReaderBookBookmark", readerBookmarkSchema);
