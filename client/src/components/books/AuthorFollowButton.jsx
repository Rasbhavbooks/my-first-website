import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { followAuthor, getFollowedAuthors, unfollowAuthor } from "../../services/authorFollowService.js";

function keyForAuthor(name) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export default function AuthorFollowButton({ authorName }) {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setFollowing(false);
    if (authLoading || !user) return () => { active = false; };
    getFollowedAuthors()
      .then((authors) => {
        if (active) setFollowing(authors.some((author) => author.authorKey === keyForAuthor(authorName)));
      })
      .catch(() => { if (active) setError(t.followError); });
    return () => { active = false; };
  }, [authorName, user?.id, authLoading, t.followError]);

  async function toggleFollow() {
    setBusy(true);
    setError("");
    try {
      if (following) {
        await unfollowAuthor(authorName);
        setFollowing(false);
      } else {
        await followAuthor(authorName);
        setFollowing(true);
      }
    } catch {
      setError(t.followError);
    } finally {
      setBusy(false);
    }
  }

  if (authLoading) return null;
  if (!user) return <p className="author-follow-login"><Link to="/login">{t.signIn}</Link> {t.signInToFollow}</p>;

  return (
    <div className="author-follow-control">
      <button className="author-follow-button" type="button" disabled={busy} aria-pressed={following} onClick={toggleFollow}>
        {busy ? t.savingChanges : following ? t.unfollowAuthor : t.followAuthor}
      </button>
      {error && <span className="author-follow-error" role="status">{error}</span>}
    </div>
  );
}
