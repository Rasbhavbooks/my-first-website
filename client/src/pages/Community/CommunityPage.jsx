import { useAuth } from "../../context/AuthContext.jsx";
import { MyDiscussionPosts } from "./MyDiscussionPosts.jsx";
import { ReadingClubs } from "./ReadingClubs.jsx";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useLanguage } from "../../hooks/useLanguage.js";

const labels = {
  gu: { title: "પુસ્તક ચર્ચાઓ", empty: "હજુ કોઈ જાહેર ચર્ચા નથી.", error: "ચર્ચાઓ મેળવી શકાઈ નહીં.", posts: "જાહેર નોંધો" },
  hi: { title: "पुस्तक चर्चाएँ", empty: "अभी कोई सार्वजनिक चर्चा नहीं है।", error: "चर्चाएँ नहीं मिल सकीं।", posts: "सार्वजनिक पोस्ट" },
  en: { title: "Book discussions", empty: "There are no public discussions yet.", error: "Could not load discussions.", posts: "Public posts" },
};

export default function CommunityPage() {
  const { language, t } = useLanguage();
  const { user } = useAuth();
  const copy = labels[language] ?? labels.en;
  const [books, setBooks] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/v1/community/discussions", { signal: controller.signal });
        if (!response.ok) throw new Error("Discussions are unavailable.");
        const result = await response.json();
        setBooks(result.data.books);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const number = new Intl.NumberFormat(language);
  return <main style={{ maxWidth: 900, margin: "32px auto", padding: "16px 24px" }}>
    <h1>{copy.title}</h1>
    <ReadingClubs />
    {user && <MyDiscussionPosts key={user.id} language={language} />}
    {failed && <p role="alert">{copy.error}</p>}
    {!books && !failed && <p role="status">{t.loadingAccount}</p>}
    {books?.length === 0 && <p>{copy.empty}</p>}
    {books?.length > 0 && <ul>{books.map(book => <li key={book.bookId}>
      <h2><Link to={"/books/" + encodeURIComponent(book.bookId) + "#book-discussion-title"}>
        {book.title?.[language] || book.title?.en || book.bookId}
      </Link></h2>
      <p>{book.author} · {copy.posts} {number.format(book.postCount)}</p>
    </li>)}</ul>}
  </main>;
}
