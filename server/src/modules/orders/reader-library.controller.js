import mongoose from "mongoose";
import Book from "../books/book.model.js";
import resolveReadingAccess from "../books/reading-access.service.js";
import DigitalBookEntitlement from "./book-entitlement.model.js";

const PAGE_SIZE = 20;
const CURSOR_PATTERN = /^[a-f0-9]{24}$/i;

function serializeLibraryBook(book, accessKind) {
  return {
    id: book.catalogueId,
    title: { en: book.title.en, gu: book.title.gu, hi: book.title.hi },
    author: book.author,
    language: book.language,
    category: book.category,
    price: book.price,
    tone: book.tone,
    badge: book.badge,
    accessKind,
  };
}

function cursorObjectId(value) {
  return value ? new mongoose.Types.ObjectId(value) : null;
}

export function createReaderLibraryController({
  findFreeCandidates,
  findEntitlements,
  findBooksByIds,
  findBookById,
  resolveAccess,
}) {
  async function accessibleBooks(candidates, readerId) {
    const results = await Promise.all(candidates.map(async (book) => {
      const access = await resolveAccess({ bookId: book.catalogueId, readerId });
      return access ? serializeLibraryBook(book, access.kind) : null;
    }));
    return results.filter(Boolean);
  }

  return {
    async list(request, response) {
      const freeCursor = request.query.freeCursor;
      const purchasedCursor = request.query.purchasedCursor;
      if ([freeCursor, purchasedCursor].some((value) => value !== undefined
        && (typeof value !== "string" || !CURSOR_PATTERN.test(value)))) {
        return response.status(400).json({
          error: { code: "INVALID_LIBRARY_CURSOR", message: "The library cursor is invalid." },
        });
      }

      const [freeRecords, entitlements] = await Promise.all([
        findFreeCandidates(cursorObjectId(freeCursor), PAGE_SIZE + 1),
        findEntitlements(request.reader._id, cursorObjectId(purchasedCursor), PAGE_SIZE + 1),
      ]);
      const freePage = freeRecords.slice(0, PAGE_SIZE);
      const entitlementPage = entitlements.slice(0, PAGE_SIZE);
      const paidBookIds = [...new Set(entitlementPage.map((item) => item.bookId))];
      const purchasedBooks = paidBookIds.length ? await findBooksByIds(paidBookIds) : [];
      const purchasedById = new Map(purchasedBooks.map((book) => [book.catalogueId, book]));

      const [freeBooks, accessiblePurchased] = await Promise.all([
        accessibleBooks(freePage, request.reader._id),
        accessibleBooks(entitlementPage.map((item) => purchasedById.get(item.bookId)).filter(Boolean), request.reader._id),
      ]);

      const data = {
        freeBooks,
        purchasedBooks: accessiblePurchased,
        freeNextCursor: freeRecords.length > PAGE_SIZE ? String(freePage.at(-1)._id) : null,
        purchasedNextCursor: entitlements.length > PAGE_SIZE ? String(entitlementPage.at(-1)._id) : null,
      };
      response.setHeader("Cache-Control", "private, no-store");
      return response.json({ data });
    },

    async getBook(request, response) {
      const bookId = request.params.bookId;
      if (typeof bookId !== "string" || !bookId.trim() || bookId.length > 64 || bookId !== bookId.trim()) {
        return response.status(404).json({ error: { code: "BOOK_NOT_FOUND", message: "Book not found." } });
      }

      const book = await findBookById(bookId);
      if (!book) return response.status(404).json({ error: { code: "BOOK_NOT_FOUND", message: "Book not found." } });
      const access = await resolveAccess({ bookId, readerId: request.reader._id });
      if (!access) {
        return response.status(404).json({ error: { code: "BOOK_NOT_FOUND", message: "Book not found." } });
      }

      response.setHeader("Cache-Control", "private, no-store");
      return response.json({ data: { book: serializeLibraryBook(book, access.kind) } });
    },
  };
}

const controller = createReaderLibraryController({
  findFreeCandidates: (cursor, limit) => Book.find({
    price: 0,
    readingSourceId: { $type: "objectId" },
    ...(cursor ? { _id: { $gt: cursor } } : {}),
  }).sort({ _id: 1 }).limit(limit).select("_id catalogueId title author language category price tone badge").lean(),
  findEntitlements: (readerId, cursor, limit) => DigitalBookEntitlement.find({
    readerId,
    ...(cursor ? { _id: { $gt: cursor } } : {}),
  }).sort({ _id: 1 }).limit(limit).select("_id bookId").lean(),
  findBooksByIds: (ids) => Book.find({ catalogueId: { $in: ids } })
    .select("catalogueId title author language category price tone badge").lean(),
  findBookById: (bookId) => Book.findOne({ catalogueId: bookId })
    .select("catalogueId title author language category price tone badge").lean(),
  resolveAccess: resolveReadingAccess,
});

export const listReaderLibrary = controller.list;
export const getReaderLibraryBook = controller.getBook;
