import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import mongoose from "mongoose";
import { requireReader, requireAdmin } from "../auth/auth.middleware.js";
import Book from "./book.model.js";

const clubSchema = new mongoose.Schema({
  bookId: { type: String, required: true, unique: true, maxlength: 64 },
  active: { type: Boolean, default: true },
}, { timestamps: true, versionKey: false });
const Club = mongoose.models.ReadingClub || mongoose.model("ReadingClub", clubSchema);

const memberSchema = new mongoose.Schema({
  clubId: { type: mongoose.Schema.Types.ObjectId, required: true },
  readerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });
memberSchema.index({ clubId: 1, readerId: 1 }, { unique: true });
export const ClubMember = mongoose.models.ReadingClubMember || mongoose.model("ReadingClubMember", memberSchema);

const limit = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false });

function send(response, data, status = 200) {
  return response.set("Cache-Control", "no-store").status(status).json({ data });
}
function fail(response, status, code, message) {
  return response.status(status).json({ error: { code, message } });
}

async function listClubs(request, response, admin = false) {
  const clubs = await Club.aggregate([
    { $match: admin ? {} : { active: true } },
    { $sort: { createdAt: -1, _id: -1 } },
    { $lookup: { from: Book.collection.name, localField: "bookId", foreignField: "catalogueId", as: "book" } },
    { $unwind: { path: "$book", preserveNullAndEmptyArrays: admin } },
    { $limit: 50 },
    { $project: { bookId: 1, active: 1, title: "$book.title" } },
  ]);
  const ids = clubs.map(club => club._id);
  const [totals, joined] = await Promise.all([
    ClubMember.aggregate([
      { $match: { clubId: { $in: ids } } },
      { $group: { _id: "$clubId", count: { $sum: 1 } } },
    ]),
    request.reader && !admin
      ? ClubMember.distinct("clubId", { clubId: { $in: ids }, readerId: request.reader._id }) : [],
  ]);
  const counts = new Map(totals.map(row => [String(row._id), row.count]));
  const membership = new Set(joined.map(String));
  return send(response, { clubs: clubs.map(club => ({
    id: String(club._id), bookId: club.bookId, title: club.title ?? null, active: club.active,
    memberCount: counts.get(String(club._id)) ?? 0, joined: membership.has(String(club._id)),
  })) });
}

export const readingClubs = Router();
readingClubs.get("/", limit,
  (request, response, next) => request.query.personal === "1" ? requireReader(request, response, next) : next(),
  (request, response) => listClubs(request, response));

async function changeMembership(request, response) {
  const { clubId } = request.params;
  if (!mongoose.isObjectIdOrHexString(clubId)) return fail(response, 404, "CLUB_NOT_FOUND", "Club not found.");
  const filter = { clubId, readerId: request.reader._id };
  const joined = request.method === "PUT";
  if (joined) {
    const club = await Club.findOne({ _id: clubId, active: true }).lean();
    if (!club || !await Book.exists({ catalogueId: club.bookId })) {
      return fail(response, 404, "CLUB_NOT_FOUND", "Club not found.");
    }
    try {
      await ClubMember.updateOne(filter, { $setOnInsert: filter }, { upsert: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  } else {
    await ClubMember.deleteOne(filter);
  }
  return send(response, { joined, memberCount: await ClubMember.countDocuments({ clubId }) });
}

readingClubs.put("/:clubId/membership", requireReader, limit, changeMembership);
readingClubs.delete("/:clubId/membership", requireReader, limit, changeMembership);

export const adminReadingClubs = Router();
adminReadingClubs.use(requireReader, requireAdmin, limit);
adminReadingClubs.get("/", (request, response) => listClubs(request, response, true));
adminReadingClubs.post("/", async (request, response) => {
  const bookId = typeof request.body?.bookId === "string" ? request.body.bookId.trim() : "";
  if (!bookId || bookId.length > 64 || !await Book.exists({ catalogueId: bookId })) {
    return fail(response, 404, "BOOK_NOT_FOUND", "Choose a catalogue book.");
  }
  try {
    const club = await Club.create({ bookId });
    return send(response, { id: club.id }, 201);
  } catch (error) {
    if (error.code !== 11000) throw error;
    return fail(response, 409, "CLUB_EXISTS", "This book already has a club.");
  }
});
adminReadingClubs.patch("/:clubId", async (request, response) => {
  if (!mongoose.isObjectIdOrHexString(request.params.clubId) || typeof request.body?.active !== "boolean") {
    return fail(response, 400, "INVALID_CLUB_STATE", "Choose a valid club state.");
  }
  const result = await Club.updateOne({ _id: request.params.clubId }, { $set: { active: request.body.active } });
  if (!result.matchedCount) return fail(response, 404, "CLUB_NOT_FOUND", "Club not found.");
  return send(response, { active: request.body.active });
});
