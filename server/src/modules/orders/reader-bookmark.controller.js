import Book from "../books/book.model.js";
import resolveReadingAccess from "../books/reading-access.service.js";
import ReaderBookBookmark from "./reader-bookmark.model.js";

function validBookId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 64 && value === value.trim();
}

function serialize(bookmark) {
  if (!bookmark) return null;
  return {
    pageNumber: bookmark.pageNumber,
    note: bookmark.note || "",
    updatedAt: bookmark.updatedAt?.toISOString?.() || bookmark.updatedAt || null,
  };
}

export function createReaderBookmarkController({
  resolveAccess,
  findBookmark,
  saveBookmark,
  deleteBookmark,
}) {
  async function requireBookAccess(bookId, readerId) {
    if (!validBookId(bookId)) return false;
    return Boolean(await resolveAccess({ bookId, readerId }));
  }

  return {
    async get(request, response) {
      response.setHeader("Cache-Control", "private, no-store");
      const { bookId } = request.params;
      if (!await requireBookAccess(bookId, request.reader._id)) {
        return response.status(404).json({ error: { code: "BOOK_NOT_FOUND", message: "Book not found." } });
      }
      const bookmark = await findBookmark(request.reader._id, bookId);
      return response.json({ data: { bookmark: serialize(bookmark) } });
    },

    async save(request, response) {
      response.setHeader("Cache-Control", "private, no-store");
      const { bookId } = request.params;
      if (!await requireBookAccess(bookId, request.reader._id)) {
        return response.status(404).json({ error: { code: "BOOK_NOT_FOUND", message: "Book not found." } });
      }
      const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
        ? request.body
        : {};
      const allowedFields = new Set(["pageNumber", "note"]);
      const hasUnexpectedField = Object.keys(body).some((key) => !allowedFields.has(key));
      const pageNumber = body.pageNumber;
      const note = body.note === undefined ? "" : typeof body.note === "string" ? body.note.trim() : null;
      if (hasUnexpectedField || !Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber > 100000
        || typeof note !== "string" || note.length > 160) {
        return response.status(400).json({
          error: { code: "INVALID_BOOKMARK", message: "Enter a page from 1 to 100000 and a note up to 160 characters." },
        });
      }

      const bookmark = await saveBookmark(request.reader._id, bookId, { pageNumber, note });
      return response.json({ data: { bookmark: serialize(bookmark) } });
    },

    async remove(request, response) {
      response.setHeader("Cache-Control", "private, no-store");
      const { bookId } = request.params;
      if (!validBookId(bookId)) {
        return response.status(404).json({ error: { code: "BOOK_NOT_FOUND", message: "Book not found." } });
      }
      const result = await deleteBookmark(request.reader._id, bookId);
      return response.json({ data: { removed: result?.deletedCount > 0 } });
    },
  };
}

const controller = createReaderBookmarkController({
  resolveAccess: resolveReadingAccess,
  findBookmark: (readerId, bookId) => ReaderBookBookmark.findOne({ readerId, bookId })
    .select("pageNumber note updatedAt -_id").lean(),
  saveBookmark: (readerId, bookId, values) => ReaderBookBookmark.findOneAndUpdate(
    { readerId, bookId },
    { $set: values, $setOnInsert: { readerId, bookId } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).select("pageNumber note updatedAt -_id").lean(),
  deleteBookmark: (readerId, bookId) => ReaderBookBookmark.deleteOne({ readerId, bookId }),
});

export const getReaderBookBookmark = controller.get;
export const saveReaderBookBookmark = controller.save;
export const deleteReaderBookBookmark = controller.remove;
