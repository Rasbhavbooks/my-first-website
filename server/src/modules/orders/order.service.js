import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { inrPriceToPaise } from "../../../../shared/money.js";
import Book from "../books/book.model.js";
import DigitalBookOrder from "./order.model.js";

function error(message, code) {
  const result = new Error(message);
  result.code = code;
  return result;
}

function orderMatchesBook(order, bookId) {
  return order.bookId === bookId;
}

export function createPendingOrderService({ findAvailableBook, findExistingOrder, createOrder }) {
  if (
    typeof findAvailableBook !== "function"
    || typeof findExistingOrder !== "function"
    || typeof createOrder !== "function"
  ) {
    throw new TypeError("Pending order service requires book lookup, order lookup, and order creation.");
  }

  return async function createPendingBookOrder({ buyerId, bookId, idempotencyKey }, { session } = {}) {
    if (!mongoose.isValidObjectId(buyerId)) {
      throw error("A valid signed-in reader is required.", "INVALID_BUYER");
    }
    if (typeof bookId !== "string" || !bookId.trim() || bookId.trim().length > 64) {
      throw error("Choose a valid catalogue book.", "INVALID_BOOK");
    }
    if (
      typeof idempotencyKey !== "string"
      || idempotencyKey.length < 16
      || idempotencyKey.length > 128
      || idempotencyKey.trim() !== idempotencyKey
    ) {
      throw error("A 16–128 character idempotency key is required.", "INVALID_IDEMPOTENCY_KEY");
    }

    const idempotencyKeyHash = createHash("sha256").update(idempotencyKey).digest("hex");
    const existing = await findExistingOrder(buyerId, idempotencyKeyHash, { session });
    if (existing) {
      if (!orderMatchesBook(existing, bookId.trim())) {
        throw error("This idempotency key was already used for a different book.", "IDEMPOTENCY_KEY_REUSED");
      }
      return { order: existing, replayed: true };
    }

    const book = await findAvailableBook(bookId.trim(), { session });
    if (!book) {
      throw error("This book is not currently available for purchase.", "BOOK_NOT_FOR_SALE");
    }
    const amountPaise = inrPriceToPaise(book.price);
    if (amountPaise === null || amountPaise < 1) {
      throw error("This book does not have a valid paid price.", "INVALID_BOOK_PRICE");
    }

    const orderData = {
      buyerId,
      idempotencyKeyHash,
      bookId: book.catalogueId,
      bookTitle: book.title,
      authorName: book.author,
      amountPaise,
      currency: "INR",
      status: "pending_payment",
    };

    try {
      const order = await createOrder(orderData, { session });
      return { order, replayed: false };
    } catch (cause) {
      if (cause?.code !== 11000) throw cause;
      const racedOrder = await findExistingOrder(buyerId, idempotencyKeyHash, { session });
      if (!racedOrder) throw cause;
      if (!orderMatchesBook(racedOrder, bookId.trim())) {
        throw error("This idempotency key was already used for a different book.", "IDEMPOTENCY_KEY_REUSED");
      }
      return { order: racedOrder, replayed: true };
    }
  };
}

const defaultService = createPendingOrderService({
  findAvailableBook: (catalogueId, { session } = {}) => {
    let query = Book.findOne({ catalogueId, availableForSale: true })
      .select("+availableForSale")
      .select("catalogueId title author price");
    if (session) query = query.session(session);
    return query.lean();
  },
  findExistingOrder: (buyerId, idempotencyKeyHash, { session } = {}) => {
    let query = DigitalBookOrder.findOne({ buyerId, idempotencyKeyHash });
    if (session) query = query.session(session);
    return query.lean();
  },
  createOrder: (orderData, { session } = {}) => new DigitalBookOrder(orderData).save({ session }),
});

export default defaultService;
