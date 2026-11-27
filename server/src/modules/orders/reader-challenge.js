import mongoose from "mongoose";
import resolveReadingAccess from "../books/reading-access.service.js";

const schema = new mongoose.Schema({
  readerId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  bookId: { type: String, maxlength: 64, required: true, immutable: true },
  completedAt: { type: Date, required: true, immutable: true },
}, { versionKey: false });
schema.index({ readerId: 1, bookId: 1 }, { unique: true });
schema.index({ readerId: 1, completedAt: 1 });
export const Completion = mongoose.models.ReaderBookCompletion || mongoose.model("ReaderBookCompletion", schema);

const indiaOffsetMs = 330 * 60 * 1000;
const target = 3;

export function challengeMonthStart(now) {
  const indiaDate = new Date(now.getTime() + indiaOffsetMs);
  return new Date(Date.UTC(indiaDate.getUTCFullYear(), indiaDate.getUTCMonth(), 1) - indiaOffsetMs);
}

export async function getReadingChallenge(request, response) {
  const completed = await Completion.countDocuments({
    readerId: request.reader._id,
    completedAt: { $gte: challengeMonthStart(new Date()) },
  });
  return response.set("Cache-Control", "no-store").json({ data: { completed, target } });
}

function completionFilter(request) {
  return { readerId: request.reader._id, bookId: request.params.bookId };
}

async function requireBookAccess(request, response) {
  const { readerId, bookId } = completionFilter(request);
  if (typeof bookId === "string" && bookId.length <= 64 && await resolveReadingAccess({ readerId, bookId })) return true;
  response.status(404).json({ error: { code: "BOOK_NOT_FOUND", message: "Book not found." } });
  return false;
}

export async function getReadingCompletion(request, response) {
  if (!await requireBookAccess(request, response)) return;
  const completed = Boolean(await Completion.exists(completionFilter(request)));
  return response.set("Cache-Control", "no-store").json({ data: { completed } });
}

export async function saveReadingCompletion(request, response) {
  if (!await requireBookAccess(request, response)) return;
  const filter = completionFilter(request);
  try {
    await Completion.updateOne(filter, { $setOnInsert: { ...filter, completedAt: new Date() } }, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  return response.set("Cache-Control", "no-store").json({ data: { completed: true } });
}

export async function deleteReadingCompletion(request, response) {
  if (typeof request.params.bookId !== "string" || request.params.bookId.length > 64) {
    return response.status(400).json({ error: { code: "INVALID_BOOK", message: "Choose a valid book." } });
  }
  await Completion.deleteOne(completionFilter(request));
  return response.set("Cache-Control", "no-store").json({ data: { completed: false } });
}
