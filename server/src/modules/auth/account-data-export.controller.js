import { isDatabaseConnected } from "../../config/database.js";
import UserWishlistItem from "../wishlist/wishlist-item.model.js";
import AuthorFollow from "./author-follow.model.js";
import AuthorApplication from "./author-application.model.js";
import AuthorProfile from "./author-profile.model.js";
import BookReview from "../books/book-review.model.js";
import ReviewHelpfulVote from "../books/review-helpful-vote.model.js";
import AuthorBook from "../books/author-book.model.js";
import AuthorBookChapter from "../books/author-book-chapter.model.js";
import ReaderBookActivity from "../orders/reader-book-activity.model.js";
import ReaderBookBookmark from "../orders/reader-bookmark.model.js";

function unavailable(response) {
  return response.status(503).json({
    error: { code: "ACCOUNT_EXPORT_UNAVAILABLE", message: "Your account data is temporarily unavailable." },
  });
}

function fileMetadata(asset) {
  if (!asset) return null;
  return {
    fileName: asset.fileName,
    contentType: asset.contentType,
    size: asset.size,
    scanStatus: asset.scanStatus,
    uploadedAt: asset.uploadedAt,
  };
}

export async function exportReaderAccountData(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  if (!isDatabaseConnected()) return unavailable(response);
  const userId = request.reader._id;
  const [
    wishlist,
    followedAuthors,
    reviews,
    helpfulVotes,
    authorApplication,
    authorProfile,
    authorBooks,
    chapters,
    readingHistory,
    readingBookmarks,
  ] = await Promise.all([
    UserWishlistItem.find({ userId }).select("catalogueId createdAt -_id").sort({ createdAt: 1 }).lean(),
    AuthorFollow.find({ userId }).select("authorKey authorName authorProfileId createdAt -_id").sort({ createdAt: 1 }).lean(),
    BookReview.find({ userId }).select("catalogueId rating body moderationStatus createdAt updatedAt -_id").sort({ createdAt: 1 }).lean(),
    ReviewHelpfulVote.find({ userId }).select("reviewId createdAt -_id").sort({ createdAt: 1 }).lean(),
    AuthorApplication.findOne({ userId })
      .select("authorName biography writingLanguages genres writingSampleUrl status createdAt updatedAt -_id").lean(),
    AuthorProfile.findOne({ userId })
      .select("slug authorName catalogueAuthorName biography writingLanguages genres writingSampleUrl websiteUrl profilePhotoUrl coverImageUrl featuredBookIds status createdAt updatedAt -_id").lean(),
    AuthorBook.find({ authorId: userId })
      .select("authorName title description isbn language category price status adminNote assets.cover.fileName assets.cover.contentType assets.cover.size assets.cover.scanStatus assets.cover.uploadedAt assets.manuscript.fileName assets.manuscript.contentType assets.manuscript.size assets.manuscript.scanStatus assets.manuscript.uploadedAt submittedAt reviewedAt createdAt updatedAt").sort({ createdAt: 1 }).lean(),
    AuthorBookChapter.find({ authorId: userId })
      .select("bookId title content order createdAt updatedAt -_id").sort({ bookId: 1, order: 1, createdAt: 1 }).lean(),
    ReaderBookActivity.find({ readerId: userId }).select("bookId lastOpenedAt -_id").sort({ lastOpenedAt: -1 }).lean(),
    ReaderBookBookmark.find({ readerId: userId }).select("bookId pageNumber note updatedAt -_id").sort({ updatedAt: -1 }).lean(),
  ]);

  const bookTitles = new Map(authorBooks.map((book) => [String(book._id), book.title]));
  const payload = {
    exportVersion: 1,
    generatedAt: new Date().toISOString(),
    account: {
      displayName: request.reader.displayName,
      email: request.reader.email,
      role: request.reader.role,
      accountStatus: request.reader.accountStatus,
      emailVerifiedAt: request.reader.emailVerifiedAt,
      bio: request.reader.bio || "",
      hobbies: request.reader.hobbies || [],
      avatarUrl: request.reader.avatarUrl || "",
      createdAt: request.reader.createdAt,
      updatedAt: request.reader.updatedAt,
    },
    reader: {
      wishlist,
      followedAuthors,
      reviews,
      helpfulVotes: helpfulVotes.map((vote) => ({ reviewId: String(vote.reviewId), createdAt: vote.createdAt })),
      readingHistory,
      bookmarks: readingBookmarks,
    },
    author: {
      application: authorApplication,
      profile: authorProfile,
      books: authorBooks.map((book) => ({
        authorName: book.authorName,
        title: book.title,
        description: book.description,
        isbn: book.isbn || "",
        language: book.language,
        category: book.category,
        plannedPriceInr: book.price,
        status: book.status,
        adminNote: book.adminNote,
        assets: {
          cover: fileMetadata(book.assets?.cover),
          manuscript: fileMetadata(book.assets?.manuscript),
        },
        submittedAt: book.submittedAt,
        reviewedAt: book.reviewedAt,
        createdAt: book.createdAt,
        updatedAt: book.updatedAt,
      })),
      chapters: chapters.map((chapter) => ({
        bookTitle: bookTitles.get(String(chapter.bookId)) || null,
        title: chapter.title,
        content: chapter.content,
        order: chapter.order,
        createdAt: chapter.createdAt,
        updatedAt: chapter.updatedAt,
      })),
    },
    excluded: [
      "Password hashes, active session tokens, verification/reset tokens, administrator MFA secrets and recovery codes are excluded.",
      "Uploaded cover and manuscript file bytes are not bundled; only their safe file metadata is included.",
      "Browser-only preferences are not stored in the account database and are not included.",
    ],
  };

  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Content-Disposition", 'attachment; filename="rasbhav-books-account-data.json"');
  return response.status(200).send(JSON.stringify(payload, null, 2));
}
