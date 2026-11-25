import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import User from "../users/user.model.js";
import ReaderSession from "./reader-session.model.js";
import PasswordResetToken from "./password-reset-token.model.js";
import VerificationToken from "./verification-token.model.js";
import AuthorApplication from "./author-application.model.js";
import AuthorFollow from "./author-follow.model.js";
import AuthorProfile from "./author-profile.model.js";
import AuthorBook from "../books/author-book.model.js";
import AuthorBookChapter from "../books/author-book-chapter.model.js";
import BookReview from "../books/book-review.model.js";
import ReviewHelpfulVote from "../books/review-helpful-vote.model.js";
import ReviewReport from "../books/review-report.model.js";
import ReaderWishlistItem from "../wishlist/wishlist-item.model.js";
import ReaderBookActivity from "../orders/reader-book-activity.model.js";
import ReaderBookBookmark from "../orders/reader-bookmark.model.js";
import DigitalBookEntitlement from "../orders/book-entitlement.model.js";
import DigitalBookOrder from "../orders/order.model.js";
import { env } from "../../config/env.js";
import { deletePrivateObject } from "../../services/r2-storage.service.js";

const SESSION_COOKIE = "rasbhav_reader_session";

export function validateAccountDeletionRequest(role, body) {
  if (role === "admin") return { status: 403, code: "ADMIN_ACCOUNT_DELETION_UNAVAILABLE" };
  if (!body || typeof body !== "object" || Array.isArray(body)
    || typeof body.currentPassword !== "string" || !body.currentPassword
    || body.currentPassword.length > 128) {
    return { status: 400, code: "CURRENT_PASSWORD_REQUIRED" };
  }
  if (body.confirmation !== "DELETE") return { status: 400, code: "DELETE_CONFIRMATION_REQUIRED" };
  return null;
}

function sendError(response, status, code, message) {
  return response.status(status).json({ error: { code, message } });
}

export async function removePrivateRecords(userId, session) {
  const profiles = await AuthorProfile.find({ userId }).select("_id").session(session).lean();
  const profileIds = profiles.map((item) => item._id);
  const books = await AuthorBook.find({ authorId: userId }).select("_id").session(session).lean();
  const bookIds = books.map((item) => item._id);
  const reviews = await BookReview.find({ userId }).select("_id").session(session).lean();
  const reviewIds = reviews.map((item) => item._id);

  await ReaderSession.deleteMany({ userId }).session(session);
  await PasswordResetToken.deleteMany({ userId }).session(session);
  await VerificationToken.deleteMany({ userId }).session(session);
  await AuthorApplication.deleteMany({ userId }).session(session);
  await AuthorFollow.deleteMany({ $or: [
    { userId },
    ...(profileIds.length ? [{ authorProfileId: { $in: profileIds } }] : []),
  ] }).session(session);
  await AuthorProfile.deleteMany({ userId }).session(session);
  await AuthorBookChapter.deleteMany({ $or: [{ authorId: userId }, { bookId: { $in: bookIds } }] }).session(session);
  await AuthorBook.deleteMany({ authorId: userId }).session(session);
  await ReviewHelpfulVote.deleteMany({ $or: [
    { userId },
    ...(reviewIds.length ? [{ reviewId: { $in: reviewIds } }] : []),
  ] }).session(session);
  await ReviewReport.deleteMany({ $or: [
    { reporterId: userId },
    ...(reviewIds.length ? [{ reviewId: { $in: reviewIds } }] : []),
  ] }).session(session);
  await BookReview.deleteMany({ userId }).session(session);
  await ReaderWishlistItem.deleteMany({ userId }).session(session);
  await ReaderBookActivity.deleteMany({ readerId: userId }).session(session);
  await ReaderBookBookmark.deleteMany({ readerId: userId }).session(session);
  await DigitalBookEntitlement.deleteMany({ readerId: userId }).session(session);
}

export async function deleteReaderAccount(request, response) {
  response.setHeader("Cache-Control", "no-store");
  const invalid = validateAccountDeletionRequest(request.reader?.role, request.body);
  if (invalid) {
    const messages = {
      ADMIN_ACCOUNT_DELETION_UNAVAILABLE: "Administrator accounts need a separate recovery process.",
      CURRENT_PASSWORD_REQUIRED: "Enter your current password to delete this account.",
      DELETE_CONFIRMATION_REQUIRED: "Type DELETE to confirm account deletion.",
    };
    return sendError(response, invalid.status, invalid.code, messages[invalid.code]);
  }

  const user = await User.findById(request.reader._id).select("+passwordHash +avatarAssetKey");
  if (!user || user.accountStatus !== "active") return sendError(response, 404, "ACCOUNT_NOT_FOUND", "This account is no longer available.");
  if (!(await user.verifyPassword(request.body.currentPassword))) {
    return sendError(response, 400, "CURRENT_PASSWORD_INCORRECT", "Current password is incorrect.");
  }

  const books = await AuthorBook.find({ authorId: user._id })
    .select("+assets.cover.key +assets.manuscript.key")
    .lean();
  const keys = [...new Set([
    user.avatarAssetKey,
    ...books.flatMap((book) => [book.assets?.cover?.key, book.assets?.manuscript?.key]),
  ].filter(Boolean))];
  if (keys.length && !env.r2Configured) return sendError(response, 503, "ACCOUNT_FILES_UNAVAILABLE", "Private file storage is unavailable. Try again later.");
  try {
    await Promise.all(keys.map((key) => deletePrivateObject(key)));
  } catch {
    return sendError(response, 503, "ACCOUNT_FILES_UNAVAILABLE", "Private files could not be removed. Try again later.");
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const current = await User.findById(user._id).select("+passwordHash").session(session);
      if (!current || current.accountStatus !== "active") {
        const error = new Error("This account is no longer available.");
        error.code = "ACCOUNT_NOT_FOUND";
        throw error;
      }
      if (!(await current.verifyPassword(request.body.currentPassword))) {
        const error = new Error("Current password is incorrect.");
        error.code = "CURRENT_PASSWORD_INCORRECT";
        throw error;
      }

      const orderCount = await DigitalBookOrder.countDocuments({ buyerId: current._id }).session(session);
      await removePrivateRecords(current._id, session);
      if (orderCount) {
        current.displayName = "Deleted account";
        current.email = "deleted-" + current._id.toString() + "@deleted.invalid";
        current.bio = "";
        current.hobbies = [];
        current.avatarUrl = "";
        for (const field of ["avatarAssetKey", "avatarAssetContentType", "avatarAssetSize", "avatarUploadedAt"]) current.set(field, undefined);
        current.role = "reader";
        current.accountStatus = "deleted";
        current.emailVerifiedAt = null;
        current.adminMfaEnabled = false;
        await current.setPassword(randomBytes(48).toString("base64url"));
        await current.save({ session });
      } else {
        await User.deleteOne({ _id: current._id }).session(session);
      }
    });
  } catch (error) {
    if (["CURRENT_PASSWORD_INCORRECT", "ACCOUNT_NOT_FOUND"].includes(error.code)) {
      return sendError(response, error.code === "ACCOUNT_NOT_FOUND" ? 404 : 400, error.code, error.message);
    }
    throw error;
  } finally {
    await session.endSession();
  }

  response.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
  return response.json({ data: { message: "Account deleted." } });
}
