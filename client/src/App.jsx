import { LanguageProvider } from "./context/LanguageContext.jsx";
import AppRoutes from "./routes/AppRoutes.jsx";

export default function App() {
  return <LanguageProvider><AppRoutes /></LanguageProvider>;
}
