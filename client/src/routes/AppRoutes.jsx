import { Route, Routes } from "react-router";
import AdminMfaGuard from "../components/auth/AdminMfaGuard.jsx";
import PublicLayout from "../layouts/PublicLayout.jsx";
import HomePage from "../pages/Home/HomePage.jsx";
import BookDetailsPage from "../pages/BookDetails/BookDetailsPage.jsx";
import CategoryPage from "../pages/Categories/CategoryPage.jsx";
import WishlistPage from "../pages/Wishlist/WishlistPage.jsx";
import RegisterPage from "../pages/Auth/RegisterPage.jsx";
import VerifyEmailPage from "../pages/Auth/VerifyEmailPage.jsx";
import LoginPage from "../pages/Auth/LoginPage.jsx";
import LoginPortalPage from "../pages/Auth/LoginPortalPage.jsx";
import AccountPage from "../pages/Auth/AccountPage.jsx";
import PasswordResetPage from "../pages/Auth/PasswordResetPage.jsx";
import ReviewModerationPage from "../pages/Admin/ReviewModerationPage.jsx";
import AuthorApplicationsPage from "../pages/Admin/AuthorApplicationsPage.jsx";
import AdminDashboardPage from "../pages/Admin/AdminDashboardPage.jsx";
import AdminAuditLogPage from "../pages/Admin/AdminAuditLogPage.jsx";
import AdminSecuritySessionsPage from "../pages/Admin/AdminSecuritySessionsPage.jsx";
import AdminUsersPage from "../pages/Admin/AdminUsersPage.jsx";
import AdminAuthorsPage from "../pages/Admin/AdminAuthorsPage.jsx";
import AdminCataloguePage from "../pages/Admin/AdminCataloguePage.jsx";
import AdminCategoriesPage from "../pages/Admin/AdminCategoriesPage.jsx";
import AdminMfaSetupPage from "../pages/Admin/AdminMfaSetupPage.jsx";
import AdminMediaLibraryPage from "../pages/Admin/AdminMediaLibraryPage.jsx";
import AdminCmsPagesPage from "../pages/Cms/AdminCmsPagesPage.jsx";
import AdminBlogPostsPage from "../pages/Cms/AdminBlogPostsPage.jsx";
import BlogPage from "../pages/Cms/BlogPage.jsx";
import BlogPostPage from "../pages/Cms/BlogPostPage.jsx";
import AdminSiteSettingsPage from "../pages/Admin/AdminSiteSettingsPage.jsx";
import CmsPageView from "../pages/Cms/CmsPageView.jsx";
import AuthorBooksAdminPage from "../pages/Admin/AuthorBooksPage.jsx";
import AuthorApplicationPage from "../pages/Auth/AuthorApplicationPage.jsx";
import AuthorStudioPage from "../pages/Auth/AuthorStudioPage.jsx";
import AuthorBooksPage from "../pages/Auth/AuthorBooksPage.jsx";
import PublicAuthorPage from "../pages/Authors/PublicAuthorPage.jsx";
import NotFoundPage from "../pages/NotFound/NotFoundPage.jsx";

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="books/:bookId" element={<BookDetailsPage />} />
        <Route path="categories/:categoryKey" element={<CategoryPage />} />
        <Route path="wishlist" element={<WishlistPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />
        <Route path="login" element={<LoginPortalPage />} />
        <Route path="reader/login" element={<LoginPage expectedRole="reader" />} />
        <Route path="author/login" element={<LoginPage expectedRole="author" />} />
        <Route path="admin/login" element={<LoginPage expectedRole="admin" />} />
        <Route path="admin/security/mfa" element={<AdminMfaSetupPage />} />
        <Route path="password-reset" element={<PasswordResetPage />} />
        <Route path="pages/:slug" element={<CmsPageView />} />
        <Route path="blog" element={<BlogPage />} />
        <Route path="blog/:slug" element={<BlogPostPage />} />
        <Route path="author/apply" element={<AuthorApplicationPage />} />
        <Route path="author/studio" element={<AuthorStudioPage />} />
        <Route path="author/books" element={<AuthorBooksPage />} />
        <Route path="authors/:slug" element={<PublicAuthorPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route element={<AdminMfaGuard />}>
          <Route path="admin" element={<AdminDashboardPage />} />
          <Route path="admin/users" element={<AdminUsersPage />} />
          <Route path="admin/audit-log" element={<AdminAuditLogPage />} />
          <Route path="admin/security/sessions" element={<AdminSecuritySessionsPage />} />
          <Route path="admin/authors" element={<AdminAuthorsPage />} />
          <Route path="admin/catalogue" element={<AdminCataloguePage />} />
          <Route path="admin/categories" element={<AdminCategoriesPage />} />
          <Route path="admin/cms-pages" element={<AdminCmsPagesPage />} />
          <Route path="admin/blog" element={<AdminBlogPostsPage />} />
          <Route path="admin/media" element={<AdminMediaLibraryPage />} />
          <Route path="admin/site-settings" element={<AdminSiteSettingsPage />} />
          <Route path="admin/review-moderation" element={<ReviewModerationPage />} />
          <Route path="admin/author-books" element={<AuthorBooksAdminPage />} />
          <Route path="admin/author-applications" element={<AuthorApplicationsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
