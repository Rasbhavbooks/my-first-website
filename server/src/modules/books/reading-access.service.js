import mongoose from "mongoose";
import { inrPriceToPaise } from "../../../../shared/money.js";
import Book from "./book.model.js";
import AuthorBook from "./author-book.model.js";
import DigitalBookEntitlement from "../orders/book-entitlement.model.js";
import DigitalBookOrder from "../orders/order.model.js";

const objectId = (value) => mongoose.isObjectIdOrHexString(value);

export function createReadingAccessService({ findBook, findApprovedSource, findEntitlement, findPaidOrder }) {
  return async function resolveReadingAccess({ bookId, readerId }) {
    if (typeof bookId !== "string" || !bookId || bookId.length > 64 || bookId !== bookId.trim()) return null;

    const book = await findBook(bookId);
    if (!book || !objectId(book.readingSourceId)) return null;
    const pricePaise = inrPriceToPaise(book.price);
    if (pricePaise === null) return null;

    // The catalogue must point to an explicitly designated, approved reading source.
    const source = await findApprovedSource(book.readingSourceId);
    if (!source || inrPriceToPaise(source.price) !== pricePaise) return null;
    const access = { sourceId: String(book.readingSourceId), kind: "free" };
    if (pricePaise === 0) return access;
    if (!objectId(readerId)) return null;

    const entitlement = await findEntitlement(readerId, bookId);
    if (!objectId(entitlement?.orderId)) return null;
    const paidOrder = await findPaidOrder(entitlement.orderId, readerId, bookId);
    if (!paidOrder || paidOrder.currency !== "INR" || entitlement.currency !== "INR"
      || paidOrder.amountPaise !== entitlement.amountPaise
      || !Number.isSafeInteger(paidOrder.amountPaise) || paidOrder.amountPaise <= 0) return null;

    // The paid order amount is a historical snapshot, independent of the current price.
    return { ...access, kind: "purchased" };
  };
}

// Internal only. No publication path sets readingSourceId yet and no reader route calls this service.
export default createReadingAccessService({
  findBook: (catalogueId) => Book.findOne({ catalogueId }).select("price +readingSourceId").lean(),
  findApprovedSource: (_id) => AuthorBook.findOne({
    _id,
    status: "approved",
    "assets.manuscript.contentType": "application/pdf",
    "assets.manuscript.scanStatus": "clean",
    "assets.manuscript.key": { $type: "string", $gt: "" },
  }).select("price").lean(),
  findEntitlement: (readerId, bookId) => DigitalBookEntitlement.findOne({ readerId, bookId })
    .select("orderId currency amountPaise").lean(),
  findPaidOrder: (_id, buyerId, bookId) => DigitalBookOrder.findOne({ _id, buyerId, bookId, status: "paid" })
    .select("currency amountPaise").lean(),
});
