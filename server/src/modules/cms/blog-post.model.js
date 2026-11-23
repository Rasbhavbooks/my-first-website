import mongoose from "mongoose";

const localizedTextSchema = new mongoose.Schema(
  {
    en: { type: String, trim: true, maxlength: 20000, default: "" },
    gu: { type: String, trim: true, maxlength: 20000, default: "" },
    hi: { type: String, trim: true, maxlength: 20000, default: "" },
  },
  { _id: false },
);

const localizedSeoSchema = new mongoose.Schema(
  {
    en: { type: String, trim: true, maxlength: 320, default: "" },
    gu: { type: String, trim: true, maxlength: 320, default: "" },
    hi: { type: String, trim: true, maxlength: 320, default: "" },
  },
  { _id: false },
);

const blogPostSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, immutable: true, lowercase: true, trim: true, maxlength: 100 },
    title: { type: localizedTextSchema, required: true },
    summary: { type: localizedTextSchema, required: true },
    body: { type: localizedTextSchema, required: true },
    seoTitle: { type: localizedSeoSchema, default: () => ({}) },
    seoDescription: { type: localizedSeoSchema, default: () => ({}) },
    status: { type: String, enum: ["draft", "published"], default: "draft", required: true, index: true },
    publishedAt: { type: Date, default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, versionKey: false },
);

blogPostSchema.index({ status: 1, publishedAt: -1 });

const BlogPost = mongoose.models.BlogPost || mongoose.model("BlogPost", blogPostSchema);
export default BlogPost;
