import { Link, useParams } from "react-router";
import BookCard from "../../components/books/BookCard.jsx";
import { useCategories } from "../../hooks/useCategories.js";
import { useBooks, useFilteredBooks } from "../../hooks/useBooks.js";
import { useLanguage } from "../../hooks/useLanguage.js";
import { usePageMetadata } from "../../hooks/usePageMetadata.js";

const styles = `
.category-page{max-width:1180px;min-height:70vh;margin:auto;padding:52px 22px 88px}
.category-page h1{margin:12px 0;color:#30252c;font:500 clamp(36px,6vw,58px)/1.1 var(--serif)}
.category-page-intro{max-width:650px;color:#77716a;font-size:13px;line-height:1.9}
.category-page-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px}
.category-page-empty{margin-top:28px;padding:32px;border:1px solid #e4ddd1;background:#fffdfa;color:#77716a}
.category-page-back{display:inline-flex;margin-bottom:22px;color:#796747;font-size:11px}
`;

export default function CategoryPage() {
  const { categoryKey = "" } = useParams();
  const { language, t } = useLanguage();
  const { categories, getCategoryLabel, loaded: categoriesLoaded } = useCategories();
  const books = useBooks();
  const category = categories.find((item) => item.key === categoryKey && item.active !== false);
  const label = category ? getCategoryLabel(category.key) : "";
  const categoryBooks = useFilteredBooks(books, { category: categoryKey, query: "", language });
  const pageTitle = label ? `${label} | Rasbhav Books` : t.notFound;
  const localizedDescription = category?.descriptions?.[language]?.trim();
  const pageDescription = label ? localizedDescription || t.categoryPageMeta.replace("{category}", label) : t.notFound;
  const schema = category ? {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: label,
    description: pageDescription,
    url: typeof window === "undefined" ? "" : window.location.href.split("?")[0],
    inLanguage: { en: "en", gu: "gu-IN", hi: "hi-IN" }[language],
    mainEntity: {
      "@type": "ItemList",
      itemListElement: categoryBooks.slice(0, 50).map((book, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Book",
          name: book.title?.[language] || book.title?.en,
          url: typeof window === "undefined" ? "" : `${window.location.origin}/books/${encodeURIComponent(book.id)}`,
        },
      })),
    },
  } : null;
  usePageMetadata({ title: pageTitle, description: pageDescription, type: "website", structuredData: schema });

  if (!category && !categoriesLoaded) {
    return <main className="category-page"><style>{styles}</style><p>{t.categoryPageLoading}</p></main>;
  }

  if (!category) {
    return <main className="category-page"><style>{styles}</style><Link className="category-page-back" to="/#discover">{t.backToCatalogue}</Link><h1>{t.categoryPageNotFound}</h1><Link to="/">{t.backHome}</Link></main>;
  }

  return (
    <main className="category-page">
      <style>{styles}</style>
      <Link className="category-page-back" to="/#discover">{t.backToCatalogue}</Link>
      <div className="eyebrow"><i />{t.categoryLabel}</div>
      <h1>{label}</h1>
      <p className="category-page-intro">{localizedDescription || t.categoryPageIntro.replace("{category}", label)}</p>
      {categoryBooks.length
        ? <div className="category-page-grid">{categoryBooks.map((book) => <BookCard key={book.id} book={book} language={language} t={t} />)}</div>
        : <div className="category-page-empty">{t.categoryPageEmpty}</div>}
    </main>
  );
}
