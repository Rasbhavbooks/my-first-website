import mongoose from "mongoose";

const readerBookActivitySchema = new mongoose.Schema({
  readerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  bookId: { type: String, required: true, trim: true, minlength: 1, maxlength: 64, immutable: true },
  lastOpenedAt: { type: Date, required: true },
}, { timestamps: true, versionKey: false });

readerBookActivitySchema.index({ readerId: 1, bookId: 1 }, { unique: true });
readerBookActivitySchema.index({ readerId: 1, lastOpenedAt: -1 });

export default mongoose.models.ReaderBookActivity
  || mongoose.model("ReaderBookActivity", readerBookActivitySchema);
