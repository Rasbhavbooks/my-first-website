import User from "../users/user.model.js";
import AuthorProfile from "../auth/author-profile.model.js";
import AuthorApplication from "../auth/author-application.model.js";
import Book from "../books/book.model.js";
import AuthorBook from "../books/author-book.model.js";
import ReviewReport from "../books/review-report.model.js";
import { env } from "../../config/env.js";
import { isDatabaseConnected } from "../../config/database.js";

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


export function getAdminPlatformReadiness(_request, response) {
  response.setHeader("Cache-Control", "no-store");
  return response.json({
    data: {
      readiness: {
        databaseConnected: isDatabaseConnected(),
        emailConfigured: env.emailConfigured,
        adminMfaKeyConfigured: env.adminMfaConfigured,
        r2CredentialsConfigured: env.r2Configured,
        clamavHostConfigured: env.clamavConfigured,
        publishingEnabled: false,
      },
    },
  });
}
