import mongoose from "mongoose";
import { categories } from "../../../../shared/catalogue.js";

const localizedTextSchema = new mongoose.Schema(
  {
    en: { type: String, trim: true, maxlength: 4000, default: "" },
    gu: { type: String, trim: true, maxlength: 4000, default: "" },
    hi: { type: String, trim: true, maxlength: 4000, default: "" },
  },
  { _id: false },
);


const assetSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, select: false },
    contentType: { type: String, required: true, enum: ["application/pdf", "image/jpeg", "image/png", "image/webp"] },
    fileName: { type: String, required: true, maxlength: 160 },
    size: { type: Number, required: true, min: 1, max: 25 * 1024 * 1024 },
    scanStatus: { type: String, required: true, enum: ["clean"] },
    uploadedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const authorBookSchema = new mongoose.Schema(
  {
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    authorName: { type: String, required: true, trim: true, maxlength: 100 },
    title: { type: localizedTextSchema, required: true },
    description: { type: localizedTextSchema, required: true },
    language: { type: String, enum: ["Gujarati", "Hindi", "English"], required: true, default: "English" },
    category: {
      type: String,
      enum: categories.filter((category) => category !== "All"),
      required: true,
      default: "Novel",
    },
    price: { type: Number, min: 0, max: 100000, required: true, default: 0 },
    status: {
      type: String,
      enum: ["draft", "submitted", "approved", "rejected"],
      required: true,
      default: "draft",
      index: true,
    },
    assets: {
      cover: { type: assetSchema, default: null },
      manuscript: { type: assetSchema, default: null },
    },
    adminNote: { type: String, trim: true, maxlength: 800, default: "" },
    submittedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

authorBookSchema.index({ authorId: 1, updatedAt: -1 });
authorBookSchema.index({ status: 1, submittedAt: 1 });

const AuthorBook = mongoose.models.AuthorBook || mongoose.model("AuthorBook", authorBookSchema);
export default AuthorBook;
