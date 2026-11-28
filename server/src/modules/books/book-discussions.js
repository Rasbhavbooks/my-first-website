import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import mongoose from "mongoose";
import { requireAdmin, requireReader } from "../auth/auth.middleware.js";
import Book from "./book.model.js";

const schema = new mongoose.Schema({
  bookId: { type: String, maxlength: 64, required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, default: null, immutable: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, required: true, select: false, index: true },
  authorName: { type: String, required: true, maxlength: 80 },
  body: { type: String, required: true, minlength: 10, maxlength: 1000 },
  status: { type: String, enum: ["pending", "approved", "hidden"], default: "pending" },
  reportedBy: { type: [mongoose.Schema.Types.ObjectId], default: [], select: false },
  needsReview: { type: Boolean, default: true },
}, { timestamps: true, versionKey: false });
schema.index({ bookId: 1, status: 1, parentId: 1, _id: -1 });
schema.index({ needsReview: 1, _id: 1 });
export const DiscussionPost = mongoose.models.BookDiscussionPost || mongoose.model("BookDiscussionPost", schema);

const likeSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  readerId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true, index: true },
}, { versionKey: false });
likeSchema.index({ postId: 1, readerId: 1 }, { unique: true });
export const DiscussionLike = mongoose.models.BookDiscussionLike || mongoose.model("BookDiscussionLike", likeSchema);

const writeLimit = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false });
const readLimit = rateLimit({ windowMs: 60_000, limit: 90, standardHeaders: "draft-8", legacyHeaders: false });

function failure(response, status, code, message) {
  return response.status(status).json({ error: { code, message } });
}

function present(post) {
  return { id: String(post._id), bookId: post.bookId, parentId: post.parentId ? String(post.parentId) : null, authorName: post.authorName, body: post.body, createdAt: post.createdAt };
}

export const bookDiscussions = Router({ mergeParams: true });
bookDiscussions.use((_request, response, next) => {
  response.set("Cache-Control", "no-store");
  next();
});
async function requirePublicParent(request, response, next) {
  const { bookId, postId } = request.params;
  const parent = mongoose.isObjectIdOrHexString(postId)
    && await DiscussionPost.exists({ _id: postId, bookId, parentId: null, status: "approved" });
  if (!parent) return failure(response, 404, "POST_NOT_FOUND", "Post not found.");
  request.discussionParentId = parent._id;
  return next();
}

async function listPosts(request, response) {
  const cursor = request.query.cursor;
  if (cursor !== undefined && (typeof cursor !== "string" || !mongoose.isObjectIdOrHexString(cursor))) {
    return failure(response, 400, "INVALID_DISCUSSION_CURSOR", "Choose a valid discussion page.");
  }
  const filter = { bookId: request.params.bookId, parentId: request.discussionParentId ?? null, status: "approved" };
  if (cursor) filter._id = { $lt: cursor };
  const posts = await DiscussionPost.find(filter).sort({ _id: -1 }).limit(21).lean();
  const visible = posts.slice(0, 20);
  const postIds = visible.map(post => post._id);
  const [totals, selected] = await Promise.all([
    DiscussionLike.aggregate([
      { $match: { postId: { $in: postIds } } },
      { $group: { _id: "$postId", count: { $sum: 1 } } },
    ]),
    request.reader ? DiscussionLike.find({ readerId: request.reader._id, postId: { $in: postIds } }).select("postId -_id").lean() : [],
  ]);
  const counts = new Map(totals.map(row => [String(row._id), row.count]));
  const liked = new Set(selected.map(row => String(row.postId)));
  const rows = visible.map(post => ({
    ...present(post), likeCount: counts.get(String(post._id)) ?? 0, liked: liked.has(String(post._id)),
  }));
  return response.json({ data: { posts: rows, nextCursor: posts.length > 20 ? rows.at(-1).id : null } });
}

async function createPost(request, response) {
  const bookId = request.params.bookId;
  const body = typeof request.body?.body === "string" ? request.body.body.trim() : "";
  if (body.length < 10 || body.length > 1000) {
    return failure(response, 400, "INVALID_DISCUSSION_BODY", "Write 10 to 1,000 characters.");
  }
  if (bookId.length > 64 || !await Book.exists({ catalogueId: bookId })) {
    return failure(response, 404, "BOOK_NOT_FOUND", "Book not found.");
  }
  const post = await DiscussionPost.create({
    bookId, body, parentId: request.discussionParentId ?? null,
    authorId: request.reader._id, authorName: request.reader.displayName,
  });
  return response.status(201).json({ data: { post: { ...present(post), status: post.status } } });
}

async function reportPost(request, response) {
  const { bookId } = request.params;
  const postId = request.params.replyId ?? request.params.postId;
  if (!mongoose.isObjectIdOrHexString(postId)) return failure(response, 404, "POST_NOT_FOUND", "Post not found.");
  const post = await DiscussionPost.findOneAndUpdate({
    _id: postId, bookId, parentId: request.discussionParentId ?? null, status: "approved", authorId: { $ne: request.reader._id },
    reportedBy: { $ne: request.reader._id }, "reportedBy.99": { $exists: false },
  }, { $addToSet: { reportedBy: request.reader._id }, $set: { needsReview: true } }).select("_id");
  if (!post) return failure(response, 409, "REPORT_UNAVAILABLE", "This post cannot be reported again or is unavailable.");
  return response.json({ data: { reported: true } });
}

function optionallyRequireReader(request, response, next) {
  return request.query.personal === "1" ? requireReader(request, response, next) : next();
}

async function updateLike(request, response) {
  const postId = request.params.replyId ?? request.params.postId;
  if (!mongoose.isObjectIdOrHexString(postId) || !await DiscussionPost.exists({
    _id: postId, bookId: request.params.bookId, parentId: request.discussionParentId ?? null, status: "approved",
  })) return failure(response, 404, "POST_NOT_FOUND", "Post not found.");
  const filter = { postId, readerId: request.reader._id };
  const liked = request.method === "PUT";
  if (liked) {
    try {
      await DiscussionLike.updateOne(filter, { $setOnInsert: filter }, { upsert: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  } else {
    await DiscussionLike.deleteOne(filter);
  }
  const likeCount = await DiscussionLike.countDocuments({ postId });
  return response.json({ data: { liked, likeCount } });
}

bookDiscussions.get("/", readLimit, optionallyRequireReader, listPosts);
bookDiscussions.post("/", requireReader, writeLimit, createPost);
bookDiscussions.post("/:postId/report", requireReader, writeLimit, reportPost);
bookDiscussions.put("/:postId/like", requireReader, writeLimit, updateLike);
bookDiscussions.delete("/:postId/like", requireReader, writeLimit, updateLike);
bookDiscussions.get("/:postId/replies", readLimit, optionallyRequireReader, requirePublicParent, listPosts);
bookDiscussions.post("/:postId/replies", requireReader, writeLimit, requirePublicParent, createPost);
bookDiscussions.post("/:postId/replies/:replyId/report", requireReader, writeLimit, requirePublicParent, reportPost);
bookDiscussions.put("/:postId/replies/:replyId/like", requireReader, writeLimit, requirePublicParent, updateLike);
bookDiscussions.delete("/:postId/replies/:replyId/like", requireReader, writeLimit, requirePublicParent, updateLike);

export const adminDiscussions = Router();
adminDiscussions.use(requireReader, requireAdmin, (_request, response, next) => {
  response.set("Cache-Control", "no-store");
  next();
});
adminDiscussions.get("/", readLimit, async (_request, response) => {
  const posts = await DiscussionPost.find({ needsReview: true }).sort({ _id: 1 }).limit(30).lean();
  return response.json({ data: { posts: posts.map(post => ({
    ...present(post), status: post.status, updatedAt: post.updatedAt,
  })) } });
});
adminDiscussions.patch("/:postId", writeLimit, async (request, response) => {
  const { postId } = request.params;
  const { status, updatedAt } = request.body ?? {};
  const revision = typeof updatedAt === "string" ? new Date(updatedAt) : new Date(NaN);
  if (!mongoose.isObjectIdOrHexString(postId) || !["approved", "hidden"].includes(status) || !Number.isFinite(revision.getTime())) {
    return failure(response, 400, "INVALID_DISCUSSION_DECISION", "Choose a valid moderation decision.");
  }
  const post = await DiscussionPost.findOneAndUpdate(
    { _id: postId, needsReview: true, updatedAt: revision },
    { $set: { status, needsReview: false } },
  ).select("_id");
  if (!post) return failure(response, 409, "DISCUSSION_CHANGED", "The post changed. Reload the moderation queue.");
  return response.json({ data: { reviewed: true } });
});
