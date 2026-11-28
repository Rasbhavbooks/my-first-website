import mongoose from "mongoose";
import User from "../users/user.model.js";
import Book from "../books/book.model.js";
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

export function readingReminderDue(now, completed) {
  if (completed >= target) return false;
  const local = new Date(now.getTime() + indiaOffsetMs);
  const nextMonth = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1) - indiaOffsetMs;
  return nextMonth - now.getTime() <= 7 * 24 * 60 * 60 * 1000;
}

export async function getReadingChallenge(request, response) {
  const now = new Date();
  const filter = { readerId: request.reader._id, completedAt: { $gte: challengeMonthStart(now) } };
  const [completed, recent] = await Promise.all([
    Completion.countDocuments(filter),
    Completion.find(filter).sort({ completedAt: -1, _id: -1 }).limit(20).select("bookId completedAt -_id").lean(),
  ]);
  const catalogue = await Book.find({ catalogueId: { $in: recent.map(row => row.bookId) } })
    .select("catalogueId title -_id").lean();
  const titles = new Map(catalogue.map(book => [book.catalogueId, book.title]));
  const books = recent.map(row => ({ ...row, title: titles.get(row.bookId) ?? null }));
  const reminderEnabled = request.reader.monthlyReadingReminder === true;
  return response.set("Cache-Control", "no-store").json({
    data: { completed, target, books, reminderEnabled, reminderDue: reminderEnabled && readingReminderDue(now, completed) },
  });
}

export async function updateReadingReminder(request, response) {
  if (typeof request.body?.enabled !== "boolean") {
    return response.status(400).json({ error: { code: "INVALID_READING_REMINDER", message: "Choose whether to receive reading reminders." } });
  }
  await User.updateOne({ _id: request.reader._id }, { $set: { monthlyReadingReminder: request.body.enabled } });
  request.reader.monthlyReadingReminder = request.body.enabled;
  return getReadingChallenge(request, response);
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
