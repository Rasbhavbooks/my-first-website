import { Outlet } from "react-router-dom";
import Footer from "../components/navigation/Footer.jsx";
import Header from "../components/navigation/Header.jsx";
import { useLanguage } from "../hooks/useLanguage.js";

export default function PublicLayout() {
  const { language } = useLanguage();
  return (
    <div id="home" className={`app locale-${language}`}>
      <Header />
      <Outlet />
      <Footer />
    </div>
  );
}
