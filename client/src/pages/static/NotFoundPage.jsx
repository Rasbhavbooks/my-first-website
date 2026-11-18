import { Link } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage.js";

export default function NotFoundPage() {
  const { t } = useLanguage();
  return <main className="not-found"><span>404</span><h1>{t.notFound}</h1><Link className="button button-dark" to="/">{t.backHome}</Link></main>;
}
