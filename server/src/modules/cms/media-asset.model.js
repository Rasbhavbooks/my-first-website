import mongoose from "mongoose";

const altTextSchema = new mongoose.Schema({
  en: { type: String, trim: true, maxlength: 300, default: "" },
  gu: { type: String, trim: true, maxlength: 300, default: "" },
  hi: { type: String, trim: true, maxlength: 300, default: "" },
}, { _id: false });

const mediaAssetSchema = new mongoose.Schema({
  key: { type: String, required: true, select: false },
  fileName: { type: String, required: true, maxlength: 140 },
  contentType: { type: String, required: true, enum: ["image/jpeg", "image/png", "image/webp"] },
  size: { type: Number, required: true, min: 1, max: 5 * 1024 * 1024 },
  scanStatus: { type: String, required: true, enum: ["clean"] },
  altText: { type: altTextSchema, required: true },
  published: { type: Boolean, required: true, default: false, index: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true, versionKey: false });

mediaAssetSchema.index({ published: 1, createdAt: -1 });

const MediaAsset = mongoose.models.MediaAsset || mongoose.model("MediaAsset", mediaAssetSchema);
export default MediaAsset;
