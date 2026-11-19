import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useLanguage } from "../../hooks/useLanguage.js";
import { getFollowedAuthors, unfollowAuthor, unfollowAuthorProfile } from "../../services/authorFollowService.js";

const styles = `
.followed-authors{margin-top:22px;padding:24px;border:1px solid var(--line);background:#fffdfa}
.followed-authors h2{margin:0 0 15px;font:500 25px var(--serif)}
.followed-author-row{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:12px 0;border-top:1px solid var(--line);font-size:12px}
.followed-author-row button{border:0;background:transparent;color:#796747;font-size:10px;text-decoration:underline;cursor:pointer}
.followed-author-row button:disabled{opacity:.6;cursor:wait}
.followed-authors-empty,.followed-authors-error{color:#81796f;font-size:11px;line-height:1.7}
.followed-authors-error{color:#863d32}
`;

export default function FollowedAuthorsPanel() {
  const { t } = useLanguage();
  const [authors, setAuthors] = useState([]);
  const [busyAuthor, setBusyAuthor] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setAuthors(await getFollowedAuthors());
      setError("");
    } catch {
      setError(t.followError);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUnfollow(author) {
    setBusyAuthor(author.authorKey);
    setError("");
    try {
      if (author.authorSlug) await unfollowAuthorProfile(author.authorSlug);
      else await unfollowAuthor(author.authorName);
      setAuthors((current) => current.filter((item) => item.authorKey !== author.authorKey));
    } catch {
      setError(t.followError);
    } finally {
      setBusyAuthor("");
    }
  }

  return (
    <section className="followed-authors">
      <style>{styles}</style>
      <h2>{t.followedAuthors}</h2>
      {error && <p className="followed-authors-error" role="alert">{error}</p>}
      {authors.length ? authors.map((author) => (
        <div className="followed-author-row" key={author.authorKey}>
          <span>{author.authorSlug ? <Link to={`/authors/${encodeURIComponent(author.authorSlug)}`}>{author.authorName}</Link> : author.authorName}</span>
          <button type="button" disabled={busyAuthor === author.authorKey} onClick={() => handleUnfollow(author)}>
            {busyAuthor === author.authorKey ? t.savingChanges : t.unfollowAuthor}
          </button>
        </div>
      )) : !error && <p className="followed-authors-empty">{t.noFollowedAuthors}</p>}
    </section>
  );
}
