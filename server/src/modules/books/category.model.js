import mongoose from "mongoose";

const localizedLabelSchema = new mongoose.Schema(
  {
    en: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    gu: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    hi: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
  },
  { _id: false },
);

const localizedDescriptionSchema = new mongoose.Schema(
  {
    en: { type: String, trim: true, maxlength: 500, default: "" },
    gu: { type: String, trim: true, maxlength: 500, default: "" },
    hi: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { _id: false },
);

const categorySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, maxlength: 50, immutable: true },
    labels: { type: localizedLabelSchema, required: true },
    descriptions: { type: localizedDescriptionSchema, default: () => ({}) },
    active: { type: Boolean, required: true, default: true, index: true },
    sortOrder: { type: Number, required: true, min: 0, max: 10000, default: 100 },
  },
  { timestamps: true, versionKey: false },
);

categorySchema.index({ active: 1, sortOrder: 1, key: 1 });

const Category = mongoose.models.Category || mongoose.model("Category", categorySchema);
export default Category;
