import mongoose from "mongoose";
import { categories } from "../../../../shared/catalogue.js";

const localizedTextSchema = new mongoose.Schema(
  {
    en: { type: String, required: true, trim: true },
    gu: { type: String, required: true, trim: true },
    hi: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const bookSchema = new mongoose.Schema(
  {
    catalogueId: { type: String, required: true, unique: true, trim: true },
    title: { type: localizedTextSchema, required: true },
    author: { type: String, required: true, trim: true, maxlength: 120 },
    language: { type: String, required: true, enum: ["Gujarati", "Hindi", "English"] },
    category: {
      type: String,
      required: true,
      enum: categories.filter((category) => category !== "All"),
    },
    price: { type: Number, required: true, min: 0 },
    tone: { type: String, required: true, trim: true },
    badge: { type: String, required: true, trim: true, maxlength: 40 },
    description: { type: localizedTextSchema, required: true },
  },
  { timestamps: true, versionKey: false },
);

const Book = mongoose.models.Book || mongoose.model("Book", bookSchema);
export default Book;
