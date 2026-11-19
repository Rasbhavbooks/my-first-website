import Book from "../books/book.model.js";
import ReaderWishlistItem from "./wishlist-item.model.js";

const BOOK_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_WISHLIST_SIZE = 500;

export async function getWishlist(request, response) {
  const items = await ReaderWishlistItem.find({ userId: request.reader._id })
    .sort({ createdAt: -1 })
    .select("catalogueId")
    .lean();
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { savedBookIds: items.map((item) => item.catalogueId) } });
}

export async function addWishlistItem(request, response) {
  const bookId = typeof request.body?.bookId === "string" ? request.body.bookId.trim() : "";
  if (!BOOK_ID_PATTERN.test(bookId)) {
    return response.status(400).json({
      error: { code: "INVALID_BOOK_ID", message: "A valid book id is required." },
    });
  }

  const bookExists = await Book.exists({ catalogueId: bookId });
  if (!bookExists) {
    return response.status(404).json({
      error: { code: "BOOK_NOT_FOUND", message: "Book not found." },
    });
  }

  const filter = { userId: request.reader._id, catalogueId: bookId };
  const current = await ReaderWishlistItem.exists(filter);
  if (!current && await ReaderWishlistItem.countDocuments({ userId: request.reader._id }) >= MAX_WISHLIST_SIZE) {
    return response.status(409).json({
      error: { code: "WISHLIST_LIMIT_REACHED", message: "Your wishlist has reached its limit." },
    });
  }

  try {
    await ReaderWishlistItem.updateOne(filter, { $setOnInsert: filter }, { upsert: true });
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
  response.status(201).json({ data: { bookId, saved: true } });
}

export async function removeWishlistItem(request, response) {
  const bookId = request.params.bookId;
  if (!BOOK_ID_PATTERN.test(bookId)) {
    return response.status(400).json({
      error: { code: "INVALID_BOOK_ID", message: "A valid book id is required." },
    });
  }

  await ReaderWishlistItem.deleteOne({ userId: request.reader._id, catalogueId: bookId });
  return response.json({ data: { bookId, saved: false } });
}
