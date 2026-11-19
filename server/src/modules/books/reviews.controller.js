import Book from "./book.model.js";
import BookReview from "./book-review.model.js";
import ReviewReport from "./review-report.model.js";

const MIN_REVIEW_LENGTH = 10;
const MAX_REVIEW_LENGTH = 2000;
const REPORT_REASONS = new Set(["spam", "abuse", "irrelevant", "other"]);

function reviewDto(review) {
  return {
    id: review.id,
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
  response.setHeader("Cache-Control", "no-store");
  return response.json({
    data: {
      reviews: records.map(reviewDto),
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
