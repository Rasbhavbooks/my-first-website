import { Outlet } from "react-router";
import Footer from "../components/layout/Footer.jsx";
import Header from "../components/layout/Header.jsx";
import AnnouncementBanner from "../components/layout/AnnouncementBanner.jsx";

export default function PublicLayout() {
  return <div id="home" className="app"><AnnouncementBanner /><Header /><Outlet /><Footer /></div>;
}
