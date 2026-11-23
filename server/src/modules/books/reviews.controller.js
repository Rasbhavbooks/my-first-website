import Book from "./book.model.js";
import BookReview from "./book-review.model.js";
import ReviewReport from "./review-report.model.js";
import ReviewHelpfulVote from "./review-helpful-vote.model.js";

const MIN_REVIEW_LENGTH = 10;
const MAX_REVIEW_LENGTH = 2000;
const REPORT_REASONS = new Set(["spam", "abuse", "irrelevant", "other"]);

function reviewDto(review, helpfulCount = 0) {
  return {
    id: review.id,
    helpfulCount,
    rating: review.rating,
    body: review.body,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    reader: {
      displayName: review.userId?.displayName || "Reader",
      avatarUrl: review.userId?.avatarUrl || "",
    },
  };
}

async function findBook(catalogueId) {
  return Book.findOne({ catalogueId }).select("catalogueId").lean();
}

function invalidReview(response) {
  return response.status(400).json({
    error: {
      code: "INVALID_REVIEW",
      message: "Choose a rating from 1 to 5 and write a review between 10 and 2000 characters.",
    },
  });
}

export async function listBookReviews(request, response) {
  const catalogueId = request.params.bookId;
  if (!(await findBook(catalogueId))) {
    return response.status(404).json({ error: { code: "BOOK_NOT_FOUND", message: "Book not found." } });
  }

  const page = Math.max(1, Math.min(1000, Number.parseInt(request.query.page, 10) || 1));
  const limit = 20;
  const [records, total, summary] = await Promise.all([
    BookReview.find({ catalogueId, moderationStatus: "visible" })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("userId", "displayName avatarUrl"),
    BookReview.countDocuments({ catalogueId, moderationStatus: "visible" }),
    BookReview.aggregate([
      { $match: { catalogueId, moderationStatus: "visible" } },
      { $group: { _id: null, averageRating: { $avg: "$rating" }, ratingCount: { $sum: 1 } } },
    ]),
  ]);

  const totals = summary[0] || { averageRating: 0, ratingCount: 0 };
  const helpfulCounts = records.length
    ? await ReviewHelpfulVote.aggregate([
      { $match: { reviewId: { $in: records.map((review) => review._id) } } },
      { $group: { _id: "$reviewId", count: { $sum: 1 } } },
    ])
    : [];
  const helpfulCountById = new Map(helpfulCounts.map((item) => [String(item._id), item.count]));
  response.setHeader("Cache-Control", "no-store");
  return response.json({
    data: {
      reviews: records.map((review) => reviewDto(review, helpfulCountById.get(String(review._id)) || 0)),
      page,
      pageSize: limit,
      total,
      averageRating: Math.round(totals.averageRating * 10) / 10,
      ratingCount: totals.ratingCount,
    },
  });
}

export async function getMyBookReview(request, response) {
  const review = await BookReview.findOne({
    catalogueId: request.params.bookId,
    userId: request.reader._id,
  });
  return response.json({ data: { review: review ? reviewDto(review) : null } });
}

export async function createBookReview(request, response) {
  const catalogueId = request.params.bookId;
  if (!(await findBook(catalogueId))) {
    return response.status(404).json({ error: { code: "BOOK_NOT_FOUND", message: "Book not found." } });
  }

  const rating = Number(request.body?.rating);
  const body = typeof request.body?.body === "string" ? request.body.body.trim() : "";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || body.length < MIN_REVIEW_LENGTH || body.length > MAX_REVIEW_LENGTH) {
    return invalidReview(response);
  }

  try {
    const review = await BookReview.create({
      catalogueId,
      userId: request.reader._id,
      rating,
      body,
    });
    await review.populate("userId", "displayName avatarUrl");
    return response.status(201).json({ data: { review: reviewDto(review) } });
  } catch (error) {
    if (error?.code === 11000) {
      return response.status(409).json({ error: { code: "REVIEW_EXISTS", message: "You have already reviewed this book." } });
    }
    throw error;
  }
}

export async function updateBookReview(request, response) {
  const rating = Number(request.body?.rating);
  const body = typeof request.body?.body === "string" ? request.body.body.trim() : "";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || body.length < MIN_REVIEW_LENGTH || body.length > MAX_REVIEW_LENGTH) {
    return invalidReview(response);
  }

  const review = await BookReview.findOneAndUpdate(
    { _id: request.params.reviewId, catalogueId: request.params.bookId, userId: request.reader._id },
    { $set: { rating, body } },
    { new: true, runValidators: true },
  ).populate("userId", "displayName avatarUrl");

  if (!review) {
    return response.status(404).json({ error: { code: "REVIEW_NOT_FOUND", message: "Your review was not found." } });
  }
  return response.json({ data: { review: reviewDto(review) } });
}

export async function deleteBookReview(request, response) {
  const review = await BookReview.findOneAndDelete({
    _id: request.params.reviewId,
    catalogueId: request.params.bookId,
    userId: request.reader._id,
  });
  if (!review) {
    return response.status(404).json({ error: { code: "REVIEW_NOT_FOUND", message: "Your review was not found." } });
  }
  await ReviewHelpfulVote.deleteMany({ reviewId: review._id });
  return response.json({ data: { deleted: true } });
}

export async function reportBookReview(request, response) {
  const reason = typeof request.body?.reason === "string" ? request.body.reason : "";
  const details = typeof request.body?.details === "string" ? request.body.details.trim() : "";
  const review = await BookReview.findOne({ _id: request.params.reviewId, catalogueId: request.params.bookId });
  if (!review) {
    return response.status(404).json({ error: { code: "REVIEW_NOT_FOUND", message: "Review not found." } });
  }
  if (String(review.userId) === String(request.reader._id)) {
    return response.status(400).json({ error: { code: "CANNOT_REPORT_OWN_REVIEW", message: "You cannot report your own review." } });
  }
  if (!REPORT_REASONS.has(reason) || details.length > 500) {
    return response.status(400).json({ error: { code: "INVALID_REVIEW_REPORT", message: "Choose a reason and keep details under 500 characters." } });
  }

  try {
    await ReviewReport.create({
      reviewId: review._id,
      reporterId: request.reader._id,
      reason,
      details,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return response.status(409).json({ error: { code: "REVIEW_ALREADY_REPORTED", message: "You have already reported this review." } });
    }
    throw error;
  }
  return response.status(201).json({ data: { reported: true } });
}


export async function listMyHelpfulVotes(request, response) {
  const catalogueId = request.params.bookId;
  if (!(await findBook(catalogueId))) {
    return response.status(404).json({ error: { code: "BOOK_NOT_FOUND", message: "Book not found." } });
  }
  const rawIds = typeof request.query.reviewIds === "string" ? request.query.reviewIds : "";
  const reviewIds = rawIds ? [...new Set(rawIds.split(","))] : [];
  if (reviewIds.length > 20 || reviewIds.some((id) => !/^[a-f0-9]{24}$/i.test(id))) {
    return response.status(400).json({ error: { code: "INVALID_REVIEW_IDS", message: "Review identifiers are invalid." } });
  }
  const visibleReviews = reviewIds.length
    ? await BookReview.find({ _id: { $in: reviewIds }, catalogueId, moderationStatus: "visible" }).select("_id").lean()
    : [];
  const votes = visibleReviews.length
    ? await ReviewHelpfulVote.find({ userId: request.reader._id, reviewId: { $in: visibleReviews.map((review) => review._id) } })
      .select("reviewId -_id").lean()
    : [];
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { reviewIds: votes.map((vote) => String(vote.reviewId)) } });
}

async function findVotableReview(request, response) {
  const review = await BookReview.findOne({
    _id: request.params.reviewId,
    catalogueId: request.params.bookId,
    moderationStatus: "visible",
  }).select("_id userId").lean();
  if (!review) {
    response.status(404).json({ error: { code: "REVIEW_NOT_FOUND", message: "Review not found." } });
    return null;
  }
  if (String(review.userId) === String(request.reader._id)) {
    response.status(400).json({ error: { code: "CANNOT_VOTE_OWN_REVIEW", message: "You cannot vote on your own review." } });
    return null;
  }
  return review;
}

export async function addHelpfulVote(request, response) {
  const review = await findVotableReview(request, response);
  if (!review) return;
  try {
    await ReviewHelpfulVote.create({ reviewId: review._id, userId: request.reader._id });
  } catch (error) {
    if (error?.code === 11000) {
      return response.status(409).json({ error: { code: "HELPFUL_VOTE_EXISTS", message: "You already marked this review as helpful." } });
    }
    throw error;
  }
  const helpfulCount = await ReviewHelpfulVote.countDocuments({ reviewId: review._id });
  return response.status(201).json({ data: { helpful: true, helpfulCount } });
}

export async function removeHelpfulVote(request, response) {
  const review = await findVotableReview(request, response);
  if (!review) return;
  await ReviewHelpfulVote.deleteOne({ reviewId: review._id, userId: request.reader._id });
  const helpfulCount = await ReviewHelpfulVote.countDocuments({ reviewId: review._id });
  return response.json({ data: { helpful: false, helpfulCount } });
}
