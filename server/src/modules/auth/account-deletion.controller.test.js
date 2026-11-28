import { DiscussionPost } from "../books/book-discussions.js";
import { Completion } from "../orders/reader-challenge.js";
import { Referral } from "../orders/reader-referral.js";
import test from "node:test";
import assert from "node:assert/strict";
import { validateAccountDeletionRequest } from "./account-deletion.controller.js";
import mongoose from "mongoose";
import AuthorApplication from "./author-application.model.js";
import AuthorFollow from "./author-follow.model.js";
import AuthorProfile from "./author-profile.model.js";
import PasswordResetToken from "./password-reset-token.model.js";
import ReaderSession from "./reader-session.model.js";
import VerificationToken from "./verification-token.model.js";
import AuthorBook from "../books/author-book.model.js";
import AuthorBookChapter from "../books/author-book-chapter.model.js";
import BookReview from "../books/book-review.model.js";
import ReviewHelpfulVote from "../books/review-helpful-vote.model.js";
import ReviewReport from "../books/review-report.model.js";
import ReaderWishlistItem from "../wishlist/wishlist-item.model.js";
import ReaderBookActivity from "../orders/reader-book-activity.model.js";
import ReaderBookBookmark from "../orders/reader-bookmark.model.js";
import DigitalBookEntitlement from "../orders/book-entitlement.model.js";
import { removePrivateRecords } from "./account-deletion.controller.js";

function findQuery(value, expectedSession) {
  return {
    select() { return this; },
    session(actualSession) { assert.equal(actualSession, expectedSession); return this; },
    lean: async () => value,
  };
}

function deleteQuery(expectedSession) {
  return {
    session: async actualSession => {
      assert.equal(actualSession, expectedSession);
      return { deletedCount: 1 };
    },
  };
}

test("private account cleanup deletes the user's profile, drafts, activity, reviews, and access records", async t => {
  const userId = new mongoose.Types.ObjectId();
  const profileId = new mongoose.Types.ObjectId();
  const bookId = new mongoose.Types.ObjectId();
  const reviewId = new mongoose.Types.ObjectId();
  const session = { transaction: true };
  const deleted = new Map();

  t.mock.method(AuthorProfile, "find", (filter) => {
    assert.deepEqual(filter, { userId });
    return findQuery([{ _id: profileId }], session);
  });
  t.mock.method(AuthorBook, "find", (filter) => {
    assert.deepEqual(filter, { authorId: userId });
    return findQuery([{ _id: bookId }], session);
  });
  t.mock.method(BookReview, "find", (filter) => {
    assert.deepEqual(filter, { userId });
    return findQuery([{ _id: reviewId }], session);
  });

  const models = [
    ReaderSession, PasswordResetToken, VerificationToken, AuthorApplication,
    AuthorFollow, AuthorProfile, AuthorBookChapter, AuthorBook, ReviewHelpfulVote,
    ReviewReport, BookReview, ReaderWishlistItem, ReaderBookActivity,
    ReaderBookBookmark, DigitalBookEntitlement, Completion, Referral, DiscussionPost,
  ];
  for (const model of models) {
    t.mock.method(model, "deleteMany", filter => {
      deleted.set(model.modelName, filter);
      return deleteQuery(session);
    });
  }

  t.mock.method(DiscussionPost, "updateMany", (filter, update) => {
    assert.deepEqual(filter, { reportedBy: userId });
    assert.deepEqual(update, { $pull: { reportedBy: userId } });
    return deleteQuery(session);
  });
  await removePrivateRecords(userId, session);

  assert.deepEqual(deleted.get("ReaderSession"), { userId });
  assert.deepEqual(deleted.get("PasswordResetToken"), { userId });
  assert.deepEqual(deleted.get("VerificationToken"), { userId });
  assert.deepEqual(deleted.get("AuthorApplication"), { userId });
  assert.deepEqual(deleted.get("AuthorFollow"), { $or: [
    { userId }, { authorProfileId: { $in: [profileId] } },
  ] });
  assert.deepEqual(deleted.get("AuthorProfile"), { userId });
  assert.deepEqual(deleted.get("AuthorBookChapter"), { $or: [
    { authorId: userId }, { bookId: { $in: [bookId] } },
  ] });
  assert.deepEqual(deleted.get("AuthorBook"), { authorId: userId });
  assert.deepEqual(deleted.get("ReviewHelpfulVote"), { $or: [
    { userId }, { reviewId: { $in: [reviewId] } },
  ] });
  assert.deepEqual(deleted.get("ReviewReport"), { $or: [
    { reporterId: userId }, { reviewId: { $in: [reviewId] } },
  ] });
  assert.deepEqual(deleted.get("BookReview"), { userId });
  assert.deepEqual(deleted.get("BookDiscussionPost"), { authorId: userId });
  assert.deepEqual(deleted.get("ReaderWishlistItem"), { userId });
  assert.deepEqual(deleted.get("ReaderBookActivity"), { readerId: userId });
  assert.deepEqual(deleted.get("ReaderBookBookmark"), { readerId: userId });
  assert.deepEqual(deleted.get("ReaderBookCompletion"), { readerId: userId });
  assert.deepEqual(deleted.get("ReaderReferral"), { readerId: userId });
  assert.deepEqual(deleted.get("DigitalBookEntitlement"), { readerId: userId });
  assert.equal(deleted.size, models.length);
});


test("deletion requires password reauthentication and exact typed confirmation", () => {
  assert.equal(validateAccountDeletionRequest("reader", null).code, "CURRENT_PASSWORD_REQUIRED");
  assert.equal(validateAccountDeletionRequest("reader", { currentPassword: "secret", confirmation: "delete" }).code, "DELETE_CONFIRMATION_REQUIRED");
  assert.equal(validateAccountDeletionRequest("reader", { currentPassword: "secret", confirmation: "DELETE" }), null);
});

test("administrator deletion is blocked", () => {
  assert.deepEqual(validateAccountDeletionRequest("admin", {}), { status: 403, code: "ADMIN_ACCOUNT_DELETION_UNAVAILABLE" });
});
