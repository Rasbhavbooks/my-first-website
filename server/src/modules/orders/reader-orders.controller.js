import mongoose from "mongoose";
import DigitalBookOrder from "./order.model.js";

const PAGE_SIZE = 20;
const CURSOR_PATTERN = /^[a-f0-9]{24}$/i;

export function serializeReaderOrder(record) {
  return {
    id: String(record._id),
    bookId: record.bookId,
    bookTitle: {
      en: record.bookTitle.en,
      gu: record.bookTitle.gu,
      hi: record.bookTitle.hi,
    },
    authorName: record.authorName,
    amountPaise: record.amountPaise,
    ...(Number.isSafeInteger(record.gstPaise) && Number.isSafeInteger(record.gatewayFeePaise)
      ? { fees: { gstPaise: record.gstPaise, gatewayFeePaise: record.gatewayFeePaise } }
      : {}),
    currency: record.currency,
    status: record.status,
    createdAt: record.createdAt,
    paidAt: record.paidAt || null,
  };
}

export async function listReaderOrders(request, response) {
  const cursor = request.query.cursor;
  if (cursor !== undefined && (typeof cursor !== "string" || !CURSOR_PATTERN.test(cursor))) {
    return response.status(400).json({
      error: { code: "INVALID_ORDER_CURSOR", message: "The order history cursor is invalid." },
    });
  }

  const filter = { buyerId: request.reader._id };
  if (cursor) filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };

  const records = await DigitalBookOrder.find(filter)
    .sort({ _id: -1 })
    .limit(PAGE_SIZE + 1)
    .select("bookId bookTitle authorName amountPaise gstPaise gatewayFeePaise currency status createdAt paidAt")
    .lean();

  const hasMore = records.length > PAGE_SIZE;
  const orders = records.slice(0, PAGE_SIZE).map(serializeReaderOrder);
  response.setHeader("Cache-Control", "private, no-store");
  return response.json({
    data: {
      orders,
      nextCursor: hasMore ? orders.at(-1).id : null,
    },
  });
}
