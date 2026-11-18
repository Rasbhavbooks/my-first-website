import { isDatabaseConnected } from "../../config/database.js";
import Book from "./book.model.js";

function serializeBook(record) {
  const {
    _id,
    catalogueId,
    createdAt,
    updatedAt,
    ...book
  } = record;
  return { ...book, id: catalogueId };
}

function databaseUnavailable(response) {
  return response.status(503).json({
    error: {
      code: "DATABASE_UNAVAILABLE",
      message: "The book catalogue is temporarily unavailable.",
    },
  });
}

export async function listBooks(_request, response) {
  if (!isDatabaseConnected()) return databaseUnavailable(response);
  const records = await Book.find().sort({ catalogueId: 1 }).lean();
  response.json({ data: records.map(serializeBook) });
}

export async function getBook(request, response) {
  if (!isDatabaseConnected()) return databaseUnavailable(response);
  const record = await Book.findOne({ catalogueId: request.params.bookId }).lean();
  if (!record) {
    return response.status(404).json({
      error: { code: "BOOK_NOT_FOUND", message: "Book not found." },
    });
  }
  return response.json({ data: serializeBook(record) });
}
