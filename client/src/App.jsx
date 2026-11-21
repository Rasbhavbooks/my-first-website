import { LanguageProvider } from "./context/LanguageContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { WishlistProvider } from "./context/WishlistContext.jsx";
import { CategoryProvider } from "./hooks/useCategories.js";
import AppRoutes from "./routes/AppRoutes.jsx";

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <WishlistProvider>
          <CategoryProvider>
            <AppRoutes />
          </CategoryProvider>
        </WishlistProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
