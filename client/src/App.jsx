import { LanguageProvider } from "./context/LanguageContext.jsx";
import { WishlistProvider } from "./context/WishlistContext.jsx";
import AppRoutes from "./routes/AppRoutes.jsx";

export default function App() {
  return (
    <LanguageProvider>
      <WishlistProvider>
        <AppRoutes />
      </WishlistProvider>
    </LanguageProvider>
  );
}
