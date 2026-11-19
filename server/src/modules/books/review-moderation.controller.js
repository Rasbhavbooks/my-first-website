import Book from "./book.model.js";
import BookReview from "./book-review.model.js";
import ReviewReport from "./review-report.model.js";

export async function listReviewReports(request, response) {
  const status = typeof request.query.status === "string" ? request.query.status : "pending";
  if (!["pending", "dismissed", "actioned"].includes(status)) {
    return response.status(400).json({ error: { code: "INVALID_REPORT_STATUS", message: "Choose a valid report status." } });
  }
  const page = Math.max(1, Math.min(1000, Number.parseInt(request.query.page, 10) || 1));
  const limit = 30;
  const [reports, total] = await Promise.all([
    ReviewReport.find({ status })
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: "reviewId", select: "catalogueId rating body moderationStatus createdAt userId", populate: { path: "userId", select: "displayName" } })
      .populate("reporterId", "displayName email")
      .populate("resolvedBy", "displayName"),
    ReviewReport.countDocuments({ status }),
  ]);
  const catalogueIds = [...new Set(reports.map((report) => report.reviewId?.catalogueId).filter(Boolean))];
  const books = await Book.find({ catalogueId: { $in: catalogueIds } }).select("catalogueId title author").lean();
  const bookMap = new Map(books.map((book) => [book.catalogueId, book]));

  response.setHeader("Cache-Control", "no-store");
  return response.json({
    data: {
      reports: reports.map((report) => {
        const review = report.reviewId;
        const book = review ? bookMap.get(review.catalogueId) : null;
        return {
          id: report.id,
          reason: report.reason,
          details: report.details,
          status: report.status,
          createdAt: report.createdAt,
          resolutionNote: report.resolutionNote,
          resolvedAt: report.resolvedAt,
          reporter: report.reporterId ? { displayName: report.reporterId.displayName, email: report.reporterId.email } : null,
          review: review ? {
            id: review.id,
            catalogueId: review.catalogueId,
            rating: review.rating,
            body: review.body,
            moderationStatus: review.moderationStatus,
            reader: review.userId ? { displayName: review.userId.displayName } : null,
            book: book ? { title: book.title, author: book.author } : null,
          } : null,
          resolvedBy: report.resolvedBy ? { displayName: report.resolvedBy.displayName } : null,
        };
      }),
      page,
      pageSize: limit,
      total,
    },
  });
}

export async function moderateBookReview(request, response) {
  const moderationStatus = request.body?.moderationStatus;
  const moderationNote = typeof request.body?.moderationNote === "string" ? request.body.moderationNote.trim() : "";
  if (!["visible", "hidden"].includes(moderationStatus) || moderationNote.length > 500) {
    return response.status(400).json({ error: { code: "INVALID_REVIEW_MODERATION", message: "Choose visible or hidden and keep the note under 500 characters." } });
  }
  const review = await BookReview.findByIdAndUpdate(
    request.params.reviewId,
    {
      $set: {
        moderationStatus,
        moderationNote,
        moderatedAt: new Date(),
        moderatedBy: request.reader._id,
      },
    },
    { new: true, runValidators: true },
  ).select("catalogueId rating moderationStatus moderatedAt");
  if (!review) return response.status(404).json({ error: { code: "REVIEW_NOT_FOUND", message: "Review not found." } });
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { review: { id: review.id, catalogueId: review.catalogueId, rating: review.rating, moderationStatus: review.moderationStatus, moderatedAt: review.moderatedAt } } });
}

export async function resolveReviewReport(request, response) {
  const status = request.body?.status;
  const resolutionNote = typeof request.body?.resolutionNote === "string" ? request.body.resolutionNote.trim() : "";
  if (!["dismissed", "actioned"].includes(status) || resolutionNote.length > 500) {
    return response.status(400).json({ error: { code: "INVALID_REPORT_RESOLUTION", message: "Choose dismissed or actioned and keep the note under 500 characters." } });
  }
  const report = await ReviewReport.findByIdAndUpdate(
    request.params.reportId,
    { $set: { status, resolutionNote, resolvedAt: new Date(), resolvedBy: request.reader._id } },
    { new: true, runValidators: true },
  ).select("status resolutionNote resolvedAt");
  if (!report) return response.status(404).json({ error: { code: "REPORT_NOT_FOUND", message: "Report not found." } });
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { report: { id: report.id, status: report.status, resolutionNote: report.resolutionNote, resolvedAt: report.resolvedAt } } });
}
