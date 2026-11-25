import mongoose from "mongoose";
import AuthorBook from "./author-book.model.js";
import resolveReadingAccess from "./reading-access.service.js";
import { getPrivateObject } from "../../services/r2-storage.service.js";
import ReaderBookActivity from "../orders/reader-book-activity.model.js";

export function createEbookReader({ resolveAccess, findApprovedManuscript, getObject, recordProgress = async () => {} }) {
  return async function readEbook(request, response) {
    const { bookId } = request.params;
    if (typeof bookId !== "string" || bookId.length > 64 || !bookId.trim()) {
      return response.status(404).json({ error: { code: "BOOK_NOT_FOUND", message: "Book not found." } });
    }
    const access = await resolveAccess({ bookId, readerId: request.reader?._id });
    if (!access || !mongoose.isValidObjectId(access.sourceId)) {
      return response.status(404).json({ error: { code: "BOOK_NOT_FOUND", message: "Book not found." } });
    }
    const manuscript = await findApprovedManuscript(access.sourceId);
    if (!manuscript?.key || manuscript.scanStatus !== "clean" || manuscript.contentType !== "application/pdf") {
      return response.status(404).json({ error: { code: "BOOK_NOT_FOUND", message: "Book not found." } });
    }
    const object = await getObject(manuscript.key);
    if (!object?.Body) return response.status(404).json({ error: { code: "BOOK_FILE_NOT_FOUND", message: "Book file not found." } });
    try { await recordProgress({ readerId: request.reader._id, bookId }); } catch { /* Reading access must not fail because history storage is unavailable. */ }
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Security-Policy", "sandbox; frame-ancestors 'self'");
    response.setHeader("X-Frame-Options", "SAMEORIGIN");
    response.setHeader("Content-Type", "application/pdf");
    if (Number.isSafeInteger(manuscript.size) && manuscript.size > 0) response.setHeader("Content-Length", String(manuscript.size));
    object.Body.on("error", () => response.destroy());
    return object.Body.pipe(response);
  };
}

export default createEbookReader({
  resolveAccess: resolveReadingAccess,
  findApprovedManuscript: (id) => AuthorBook.findOne({
    _id: id, status: "approved",
    "assets.manuscript.contentType": "application/pdf",
    "assets.manuscript.scanStatus": "clean",
    "assets.manuscript.key": { $type: "string", $gt: "" },
  }).select("+assets.manuscript.key").lean().then((book) => book?.assets?.manuscript ?? null),
  getObject: getPrivateObject,
  recordProgress: ({ readerId, bookId }) => ReaderBookActivity.findOneAndUpdate(
    { readerId, bookId },
    { $set: { lastOpenedAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).select("_id").lean(),
});
