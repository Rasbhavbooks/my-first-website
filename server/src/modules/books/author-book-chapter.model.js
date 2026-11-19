import mongoose from "mongoose";

const authorBookChapterSchema = new mongoose.Schema(
  {
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: "AuthorBook", required: true, index: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    content: { type: String, required: true, maxlength: 100000 },
    order: { type: Number, required: true, min: 1, max: 100 },
  },
  { timestamps: true, versionKey: false },
);

authorBookChapterSchema.index({ bookId: 1, order: 1, createdAt: 1 });
authorBookChapterSchema.index({ authorId: 1, bookId: 1 });

const AuthorBookChapter = mongoose.models.AuthorBookChapter
  || mongoose.model("AuthorBookChapter", authorBookChapterSchema);
export default AuthorBookChapter;
