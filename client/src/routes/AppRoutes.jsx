import { Route, Routes } from "react-router";
import PublicLayout from "../layouts/PublicLayout.jsx";
import HomePage from "../pages/Home/HomePage.jsx";
import BookDetailsPage from "../pages/BookDetails/BookDetailsPage.jsx";
import WishlistPage from "../pages/Wishlist/WishlistPage.jsx";
import RegisterPage from "../pages/Auth/RegisterPage.jsx";
import LoginPage from "../pages/Auth/LoginPage.jsx";
import AccountPage from "../pages/Auth/AccountPage.jsx";
import PasswordResetPage from "../pages/Auth/PasswordResetPage.jsx";
import NotFoundPage from "../pages/NotFound/NotFoundPage.jsx";

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="books/:bookId" element={<BookDetailsPage />} />
        <Route path="wishlist" element={<WishlistPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="password-reset" element={<PasswordResetPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
