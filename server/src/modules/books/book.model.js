import { normalizeIsbn } from "../../../../shared/isbn.js";
import mongoose from "mongoose";

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
    isbn: {
      type: String,
      trim: true,
      default: "",
      maxlength: 13,
      validate: { validator: (value) => !value || normalizeIsbn(value) === value, message: "Enter a valid ISBN-10 or ISBN-13." },
    },
    language: { type: String, required: true, enum: ["Gujarati", "Hindi", "English"] },
    category: { type: String, required: true, trim: true, maxlength: 50 },
    price: { type: Number, required: true, min: 0 },
    tone: { type: String, required: true, trim: true },
    badge: { type: String, required: true, trim: true, maxlength: 40 },
    description: { type: localizedTextSchema, required: true },
  },
  { timestamps: true, versionKey: false },
);

const Book = mongoose.models.Book || mongoose.model("Book", bookSchema);
export default Book;
