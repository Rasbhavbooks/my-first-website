import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import mongoose from "mongoose";
import { requireAdmin, requireReader } from "../auth/auth.middleware.js";
import Book from "./book.model.js";

const reasonKeys = ["spam", "abuse", "personal_information", "other"];
const reportCountsSchema = new mongoose.Schema(
  Object.fromEntries(reasonKeys.map(reason => [reason, { type: Number, min: 0 }])),
  { _id: false },
);

const schema = new mongoose.Schema({
  bookId: { type: String, maxlength: 64, required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, default: null, immutable: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, required: true, select: false, index: true },
  authorName: { type: String, required: true, maxlength: 80 },
  body: { type: String, required: true, minlength: 10, maxlength: 1000 },
  status: { type: String, enum: ["pending", "approved", "hidden"], default: "pending" },
  reportedBy: { type: [mongoose.Schema.Types.ObjectId], default: [], select: false },
  reportCounts: { type: reportCountsSchema, select: false },
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

const blockSchema = new mongoose.Schema({
  readerId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  blockedId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true, index: true },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });
blockSchema.index({ readerId: 1, blockedId: 1 }, { unique: true });
export const DiscussionBlock = mongoose.models.BookDiscussionBlock || mongoose.model("BookDiscussionBlock", blockSchema);

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
async function hiddenAuthors(request) {
  if (!request.reader) return [];
  return DiscussionBlock.distinct("blockedId", { readerId: request.reader._id });
}

async function requirePublicParent(request, response, next) {
  const { bookId, postId } = request.params;
  const parent = mongoose.isObjectIdOrHexString(postId)
    && await DiscussionPost.exists({
      _id: postId, bookId, parentId: null, status: "approved",
      authorId: { $nin: await hiddenAuthors(request) },
    });
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
  if (request.reader) filter.authorId = { $nin: await hiddenAuthors(request) };
  const posts = await DiscussionPost.find(filter).select("+authorId").sort({ _id: -1 }).limit(21).lean();
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
    owned: Boolean(request.reader && String(post.authorId) === String(request.reader._id)),
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
  const reason = request.body?.reason ?? "other";
  if (!reasonKeys.includes(reason)) {
    return failure(response, 400, "INVALID_REPORT_REASON", "Choose a reason for the report.");
  }
  const { bookId } = request.params;
  const postId = request.params.replyId ?? request.params.postId;
  if (!mongoose.isObjectIdOrHexString(postId)) return failure(response, 404, "POST_NOT_FOUND", "Post not found.");
  const post = await DiscussionPost.findOneAndUpdate({
    _id: postId, bookId, parentId: request.discussionParentId ?? null, status: "approved", authorId: { $ne: request.reader._id },
    reportedBy: { $ne: request.reader._id }, "reportedBy.99": { $exists: false },
  }, {
    $addToSet: { reportedBy: request.reader._id },
    $inc: { ["reportCounts." + reason]: 1 },
    $set: { needsReview: true },
  }).select("_id");
  if (!post) return failure(response, 409, "REPORT_UNAVAILABLE", "This post cannot be reported again or is unavailable.");
  return response.json({ data: { reported: true } });
}

async function blockPostAuthor(request, response) {
  const postId = request.params.replyId ?? request.params.postId;
  const post = mongoose.isObjectIdOrHexString(postId) && await DiscussionPost.findOne({
    _id: postId, bookId: request.params.bookId, parentId: request.discussionParentId ?? null, status: "approved",
    authorId: { $ne: request.reader._id },
  }).select("+authorId").lean();
  if (!post) return failure(response, 404, "POST_NOT_FOUND", "Post not found or you wrote it yourself.");
  const filter = { readerId: request.reader._id, blockedId: post.authorId };
  try {
    await DiscussionBlock.updateOne(filter, { $setOnInsert: filter }, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  return response.json({ data: { blocked: true } });
}

async function listBlocks(request, response) {
  const rows = await DiscussionBlock.find({ readerId: request.reader._id }).sort({ createdAt: -1 })
    .populate({ path: "blockedId", select: "displayName" }).lean();
  return response.json({ data: { blocks: rows.map(row => ({
    id: String(row._id), displayName: row.blockedId?.displayName ?? "",
  })) } });
}

async function removeBlock(request, response) {
  if (!mongoose.isObjectIdOrHexString(request.params.blockId)) {
    return failure(response, 400, "INVALID_BLOCK", "Choose a valid block.");
  }
  await DiscussionBlock.deleteOne({ _id: request.params.blockId, readerId: request.reader._id });
  return response.json({ data: { blocked: false } });
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
bookDiscussions.get("/blocks", requireReader, readLimit, listBlocks);
bookDiscussions.delete("/blocks/:blockId", requireReader, writeLimit, removeBlock);
bookDiscussions.post("/:postId/block", requireReader, writeLimit, blockPostAuthor);
bookDiscussions.post("/:postId/report", requireReader, writeLimit, reportPost);
bookDiscussions.put("/:postId/like", requireReader, writeLimit, updateLike);
bookDiscussions.delete("/:postId/like", requireReader, writeLimit, updateLike);
bookDiscussions.get("/:postId/replies", readLimit, optionallyRequireReader, requirePublicParent, listPosts);
bookDiscussions.post("/:postId/replies", requireReader, writeLimit, requirePublicParent, createPost);
bookDiscussions.post("/:postId/replies/:replyId/block", requireReader, writeLimit, requirePublicParent, blockPostAuthor);
bookDiscussions.post("/:postId/replies/:replyId/report", requireReader, writeLimit, requirePublicParent, reportPost);
bookDiscussions.put("/:postId/replies/:replyId/like", requireReader, writeLimit, requirePublicParent, updateLike);
bookDiscussions.delete("/:postId/replies/:replyId/like", requireReader, writeLimit, requirePublicParent, updateLike);

export const communityDiscussions = Router();
communityDiscussions.get("/discussions", readLimit, async (_request, response) => {
  const books = await DiscussionPost.aggregate([
    { $match: { status: "approved", parentId: null } },
    { $group: { _id: "$bookId", postCount: { $sum: 1 }, lastPostAt: { $max: "$createdAt" } } },
    { $sort: { lastPostAt: -1, _id: 1 } },
    { $lookup: {
      from: Book.collection.name, localField: "_id", foreignField: "catalogueId", as: "book",
      pipeline: [{ $project: { _id: 0, title: 1, author: 1 } }],
    } },
    { $unwind: "$book" },
    { $limit: 24 },
    { $project: { _id: 0, bookId: "$_id", title: "$book.title", author: "$book.author", postCount: 1 } },
  ]);
  return response.set("Cache-Control", "no-store").json({ data: { books } });
});

export const adminDiscussions = Router();
adminDiscussions.use(requireReader, requireAdmin, (_request, response, next) => {
  response.set("Cache-Control", "no-store");
  next();
});
adminDiscussions.get("/", readLimit, async (_request, response) => {
  const posts = await DiscussionPost.find({ needsReview: true }).select("+reportCounts").sort({ _id: 1 }).limit(30).lean();
  return response.json({ data: { posts: posts.map(post => ({
    ...present(post), status: post.status, updatedAt: post.updatedAt, reportCounts: post.reportCounts ?? {},
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
    { $set: { status, needsReview: false }, $unset: { reportCounts: 1 } },
  ).select("_id");
  if (!post) return failure(response, 409, "DISCUSSION_CHANGED", "The post changed. Reload the moderation queue.");
  return response.json({ data: { reviewed: true } });
});
