import { Outlet } from "react-router-dom";
import Footer from "../components/layout/Footer.jsx";
import Header from "../components/layout/Header.jsx";

export default function PublicLayout() {
  return <div id="home" className="app"><Header /><Outlet /><Footer /></div>;
}
