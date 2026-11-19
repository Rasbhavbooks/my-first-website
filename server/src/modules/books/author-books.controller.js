import mongoose from "mongoose";
import { categories } from "../../../../shared/catalogue.js";
import AuthorProfile from "../auth/author-profile.model.js";
import AuthorBook from "./author-book.model.js";

const LANGUAGES = new Set(["Gujarati", "Hindi", "English"]);
const LANGUAGE_KEYS = { Gujarati: "gu", Hindi: "hi", English: "en" };
const CATEGORY_SET = new Set(categories.filter((category) => category !== "All"));

function errorResponse(response, status, code, message) {
  return response.status(status).json({ error: { code, message } });
}

function localizedValues(value, maximum) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = {};
  for (const key of ["en", "gu", "hi"]) {
    if (value[key] !== undefined && typeof value[key] !== "string") return null;
    const text = typeof value[key] === "string" ? value[key].trim() : "";
    if (text.length > maximum) return null;
    result[key] = text;
  }
  return result;
}

function validFields(body, requireDescription = false) {
  const language = body?.language;
  const category = body?.category;
  const title = localizedValues(body?.title, 160);
  const description = localizedValues(body?.description, 4000);
  const price = Number(body?.price);
  if (!LANGUAGES.has(language) || !CATEGORY_SET.has(category) || !title || !description
    || !Number.isFinite(price) || price < 0 || price > 100000 || Math.abs(price * 100 - Math.round(price * 100)) > 1e-7) {
    return null;
  }
  const key = LANGUAGE_KEYS[language];
  if ((title[key].length > 0 && title[key].length < 2) || (requireDescription && (title[key].length < 2 || description[key].length < 40))) return null;
  return { title, description, language, category, price };
}

function assetDto(asset) {
  if (!asset) return null;
  return { fileName: asset.fileName, contentType: asset.contentType, size: asset.size, scanStatus: asset.scanStatus, uploadedAt: asset.uploadedAt };
}

function authorBookDto(book) {
  return {
    id: book.id,
    authorName: book.authorName,
    title: book.title,
    description: book.description,
    language: book.language,
    category: book.category,
    price: book.price,
    status: book.status,
    adminNote: book.adminNote,
    assets: { cover: assetDto(book.assets?.cover), manuscript: assetDto(book.assets?.manuscript) },
    submittedAt: book.submittedAt,
    reviewedAt: book.reviewedAt,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
  };
}

export async function listMyAuthorBooks(request, response) {
  const books = await AuthorBook.find({ authorId: request.reader._id })
    .sort({ updatedAt: -1 })
    .limit(50);
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { books: books.map(authorBookDto) } });
}

export async function createAuthorBookDraft(request, response) {
  const profile = await AuthorProfile.findOne({ userId: request.reader._id, status: "active" }).select("authorName");
  if (!profile) return errorResponse(response, 403, "AUTHOR_PROFILE_REQUIRED", "An active author profile is required.");
  const book = await AuthorBook.create({
    authorId: request.reader._id,
    authorName: profile.authorName,
    title: { en: "", gu: "", hi: "" },
    description: { en: "", gu: "", hi: "" },
  });
  response.setHeader("Cache-Control", "no-store");
  return response.status(201).json({ data: { book: authorBookDto(book) } });
}

export async function updateAuthorBookDraft(request, response) {
  if (!mongoose.isValidObjectId(request.params.bookId)) {
    return errorResponse(response, 404, "AUTHOR_BOOK_NOT_FOUND", "Book draft not found.");
  }
  const fields = validFields(request.body);
  if (!fields) return errorResponse(response, 400, "INVALID_AUTHOR_BOOK", "Check the title, description, language, category, and price.");
  const book = await AuthorBook.findOneAndUpdate(
    { _id: request.params.bookId, authorId: request.reader._id, status: { $in: ["draft", "rejected"] } },
    { $set: { ...fields, adminNote: "" } },
    { new: true, runValidators: true },
  );
  if (!book) return errorResponse(response, 404, "AUTHOR_BOOK_NOT_EDITABLE", "This draft was not found or can no longer be edited.");
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { book: authorBookDto(book) } });
}

export async function submitAuthorBook(request, response) {
  if (!mongoose.isValidObjectId(request.params.bookId)) {
    return errorResponse(response, 404, "AUTHOR_BOOK_NOT_FOUND", "Book draft not found.");
  }
  const current = await AuthorBook.findOne({
    _id: request.params.bookId,
    authorId: request.reader._id,
    status: { $in: ["draft", "rejected"] },
  }).select("+assets.cover.key +assets.manuscript.key");
  if (!current) return errorResponse(response, 404, "AUTHOR_BOOK_NOT_EDITABLE", "This draft was not found or can no longer be submitted.");
  const fields = validFields(current, true);
  if (!current.assets?.cover?.key || !current.assets?.manuscript?.key) return errorResponse(response, 400, "AUTHOR_BOOK_ASSETS_REQUIRED", "Upload a cover and a manuscript and wait for the security scan before submitting.");
  if (!fields return errorResponse(response, 400, "AUTHOR_BOOK_INCOMPLETE", "Add a title and a description of at least 40 characters in the book's language before submitting.");
  const book = await AuthorBook.findOneAndUpdate(
    { _id: current._id, authorId: request.reader._id, status: { $in: ["draft", "rejected"] } },
    { $set: { ...fields, status: "submitted", submittedAt: new Date(), adminNote: "" } },
    { new: true, runValidators: true },
  );
  if (!book) return errorResponse(response, 409, "AUTHOR_BOOK_ALREADY_SUBMITTED", "This book has already been submitted.");
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { book: authorBookDto(book) } });
}
