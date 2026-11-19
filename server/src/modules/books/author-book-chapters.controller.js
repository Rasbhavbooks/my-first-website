import mongoose from "mongoose";
import AuthorBook from "./author-book.model.js";
import AuthorBookChapter from "./author-book-chapter.model.js";

const MAX_CHAPTERS = 100;
const MAX_CONTENT_LENGTH = 100000;

function errorResponse(response, status, code, message) {
  return response.status(status).json({ error: { code, message } });
}

function chapterDto(chapter) {
  return {
    id: chapter._id?.toString() || chapter.id,
    title: chapter.title,
    content: chapter.content,
    order: chapter.order,
    createdAt: chapter.createdAt,
    updatedAt: chapter.updatedAt,
  };
}

function validChapter(body) {
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const content = typeof body?.content === "string" ? body.content : "";
  const order = body?.order === undefined ? undefined : Number(body.order);
  if (!title || title.length > 160 || !content.trim() || content.length > MAX_CONTENT_LENGTH) return null;
  if (order !== undefined && (!Number.isInteger(order) || order < 1 || order > MAX_CHAPTERS)) return null;
  return { title, content, ...(order === undefined ? {} : { order }) };
}

async function findBook(bookId, authorId, editable = false) {
  if (!mongoose.isValidObjectId(bookId)) return null;
  return AuthorBook.findOne({
    _id: bookId,
    authorId,
    ...(editable ? { status: { $in: ["draft", "rejected"] } } : {}),
  }).select("_id authorId status");
}

export async function listMyAuthorBookChapters(request, response) {
  const book = await findBook(request.params.bookId, request.reader._id);
  if (!book) return errorResponse(response, 404, "AUTHOR_BOOK_NOT_FOUND", "Book not found.");
  const chapters = await AuthorBookChapter.find({ bookId: book._id, authorId: request.reader._id })
    .sort({ order: 1, createdAt: 1 })
    .limit(MAX_CHAPTERS)
    .lean();
  response.setHeader("Cache-Control", "private, no-store");
  return response.json({ data: { chapters: chapters.map(chapterDto) } });
}

export async function createAuthorBookChapter(request, response) {
  const book = await findBook(request.params.bookId, request.reader._id, true);
  if (!book) return errorResponse(response, 404, "AUTHOR_BOOK_NOT_EDITABLE", "This book is not available for chapter editing.");
  const values = validChapter(request.body);
  if (!values || values.order !== undefined) {
    return errorResponse(response, 400, "INVALID_BOOK_CHAPTER", "Add a title and chapter text. Chapters can contain up to 100,000 characters.");
  }
  const currentCount = await AuthorBookChapter.countDocuments({ bookId: book._id, authorId: request.reader._id });
  if (currentCount >= MAX_CHAPTERS) return errorResponse(response, 400, "CHAPTER_LIMIT_REACHED", "A book can contain at most 100 chapters.");
  const chapter = await AuthorBookChapter.create({
    bookId: book._id,
    authorId: request.reader._id,
    ...values,
    order: currentCount + 1,
  });
  response.setHeader("Cache-Control", "private, no-store");
  return response.status(201).json({ data: { chapter: chapterDto(chapter) } });
}

export async function updateAuthorBookChapter(request, response) {
  const book = await findBook(request.params.bookId, request.reader._id, true);
  if (!book) return errorResponse(response, 404, "AUTHOR_BOOK_NOT_EDITABLE", "This book is not available for chapter editing.");
  if (!mongoose.isValidObjectId(request.params.chapterId)) return errorResponse(response, 404, "BOOK_CHAPTER_NOT_FOUND", "Chapter not found.");
  const values = validChapter(request.body);
  if (!values) return errorResponse(response, 400, "INVALID_BOOK_CHAPTER", "Add a title and chapter text. Chapters can contain up to 100,000 characters.");
  const chapter = await AuthorBookChapter.findOneAndUpdate(
    { _id: request.params.chapterId, bookId: book._id, authorId: request.reader._id },
    { $set: values },
    { new: true, runValidators: true },
  );
  if (!chapter) return errorResponse(response, 404, "BOOK_CHAPTER_NOT_FOUND", "Chapter not found.");
  response.setHeader("Cache-Control", "private, no-store");
  return response.json({ data: { chapter: chapterDto(chapter) } });
}

export async function deleteAuthorBookChapter(request, response) {
  const book = await findBook(request.params.bookId, request.reader._id, true);
  if (!book) return errorResponse(response, 404, "AUTHOR_BOOK_NOT_EDITABLE", "This book is not available for chapter editing.");
  if (!mongoose.isValidObjectId(request.params.chapterId)) return errorResponse(response, 404, "BOOK_CHAPTER_NOT_FOUND", "Chapter not found.");
  const chapter = await AuthorBookChapter.findOneAndDelete({
    _id: request.params.chapterId,
    bookId: book._id,
    authorId: request.reader._id,
  });
  if (!chapter) return errorResponse(response, 404, "BOOK_CHAPTER_NOT_FOUND", "Chapter not found.");
  await AuthorBookChapter.updateMany(
    { bookId: book._id, authorId: request.reader._id, order: { $gt: chapter.order } },
    { $inc: { order: -1 } },
  );
  response.setHeader("Cache-Control", "private, no-store");
  return response.json({ data: { deleted: true } });
}

export async function listSubmittedAuthorBookChapters(request, response) {
  if (!mongoose.isValidObjectId(request.params.bookId)) return errorResponse(response, 404, "AUTHOR_BOOK_NOT_FOUND", "Book not found.");
  const book = await AuthorBook.findOne({ _id: request.params.bookId, status: "submitted" }).select("_id");
  if (!book) return errorResponse(response, 404, "AUTHOR_BOOK_NOT_REVIEWABLE", "Submitted book not found.");
  const chapters = await AuthorBookChapter.find({ bookId: book._id })
    .sort({ order: 1, createdAt: 1 })
    .limit(MAX_CHAPTERS)
    .lean();
  response.setHeader("Cache-Control", "private, no-store");
  return response.json({ data: { chapters: chapters.map(chapterDto) } });
}
