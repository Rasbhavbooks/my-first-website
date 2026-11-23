import mongoose from "mongoose";
import AuthorBook from "./author-book.model.js";

function errorResponse(response, status, code, message) {
  return response.status(status).json({ error: { code, message } });
}

function assetDto(asset) {
  if (!asset) return null;
  return { fileName: asset.fileName, contentType: asset.contentType, size: asset.size, scanStatus: asset.scanStatus, uploadedAt: asset.uploadedAt };
}

function adminBookDto(book) {
  return {
    id: book.id,
    authorName: book.authorName,
    title: book.title,
    description: book.description,
    isbn: book.isbn || "",
    language: book.language,
    category: book.category,
    price: book.price,
    status: book.status,
    adminNote: book.adminNote,
    assets: { cover: assetDto(book.assets?.cover), manuscript: assetDto(book.assets?.manuscript) },
    submittedAt: book.submittedAt,
    createdAt: book.createdAt,
    author: book.authorId ? {
      id: book.authorId.id,
      displayName: book.authorId.displayName,
      email: book.authorId.email,
    } : null,
  };
}

export async function listSubmittedAuthorBooks(_request, response) {
  const [books, total] = await Promise.all([
    AuthorBook.find({ status: "submitted" })
      .sort({ submittedAt: 1 })
      .limit(50)
      .select("+assets.cover.key +assets.manuscript.key")
      .populate("authorId", "displayName email"),
    AuthorBook.countDocuments({ status: "submitted" }),
  ]);
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { books: books.map(adminBookDto), total } });
}

export async function reviewAuthorBook(request, response) {
  if (!mongoose.isValidObjectId(request.params.bookId)) {
    return errorResponse(response, 404, "AUTHOR_BOOK_NOT_FOUND", "Submitted book not found.");
  }
  const decision = request.body?.decision;
  const adminNote = typeof request.body?.adminNote === "string" ? request.body.adminNote.trim() : "";
  if (!["approved", "rejected"].includes(decision) || adminNote.length > 800) {
    return errorResponse(response, 400, "INVALID_BOOK_REVIEW", "Choose approve or reject and keep the note under 800 characters.");
  }
  const book = await AuthorBook.findOneAndUpdate(
    { _id: request.params.bookId, status: "submitted" },
    { $set: { status: decision, adminNote, reviewedBy: request.reader._id, reviewedAt: new Date() } },
    { new: true, runValidators: true },
  );
  if (!book) return errorResponse(response, 404, "AUTHOR_BOOK_NOT_REVIEWABLE", "This submitted book was already reviewed or no longer exists.");
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { book: adminBookDto(book) } });
}
