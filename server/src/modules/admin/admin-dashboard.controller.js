import User from "../users/user.model.js";
import AuthorProfile from "../auth/author-profile.model.js";
import AuthorApplication from "../auth/author-application.model.js";
import Book from "../books/book.model.js";
import AuthorBook from "../books/author-book.model.js";
import ReviewReport from "../books/review-report.model.js";
import { env } from "../../config/env.js";
import { isDatabaseConnected } from "../../config/database.js";
import { isClamavReachable } from "../../services/clamav.service.js";
import { isR2BucketReachable } from "../../services/r2-storage.service.js";

export async function getAdminDashboardStats(_request, response) {
  const [
    totalUsers,
    totalReaders,
    totalAuthors,
    totalCatalogueBooks,
    pendingAuthorApplications,
    pendingBookReviews,
    pendingReviewReports,
  ] = await Promise.all([
    User.countDocuments({ accountStatus: "active" }),
    User.countDocuments({ role: "reader", accountStatus: "active" }),
    AuthorProfile.countDocuments({ status: "active" }),
    Book.countDocuments({}),
    AuthorApplication.countDocuments({ status: "pending" }),
    AuthorBook.countDocuments({ status: "submitted" }),
    ReviewReport.countDocuments({ status: "pending" }),
  ]);

  response.setHeader("Cache-Control", "no-store");
  return response.json({
    data: {
      stats: {
        totalUsers,
        totalReaders,
        totalAuthors,
        totalCatalogueBooks,
        pendingAuthorApplications,
        pendingBookReviews,
        pendingReviewReports,
      },
    },
  });
}


export function buildPlatformReadiness({
  environment,
  databaseConnected,
  r2BucketReachable = null,
  clamavReachable,
}) {
  return {
    databaseConnected,
    emailConfigured: environment.emailConfigured,
    adminMfaKeyConfigured: environment.adminMfaConfigured,
    r2CredentialsConfigured: environment.r2Configured,
    r2BucketReachable,
    clamavHostConfigured: environment.clamavConfigured,
    clamavReachable,
    razorpayConfigured: environment.razorpayConfigured,
    razorpayWebhookConfigured: environment.razorpayWebhookConfigured,
    razorpayMode: environment.razorpayMode,
    publishingEnabled: false,
    checkoutEnabled: false,
  };
}

export async function getAdminPlatformReadiness(request, response) {
  const [clamavReachable, r2BucketReachable] = await Promise.all([
    isClamavReachable(),
    request.query.probeR2 === "true" ? isR2BucketReachable() : null,
  ]);
  response.setHeader("Cache-Control", "no-store");
  return response.json({
    data: {
      readiness: buildPlatformReadiness({
        environment: env,
        databaseConnected: isDatabaseConnected(),
        r2BucketReachable,
        clamavReachable,
      }),
    },
  });
}
