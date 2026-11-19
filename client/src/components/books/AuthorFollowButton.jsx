import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { followAuthor, getFollowedAuthors, unfollowAuthor } from "../../services/authorFollowService.js";

const styles = `.author-follow-control{display:flex;align-items:center;gap:10px;margin:12px 0}.author-follow-button{min-height:36px;padding:0 14px;border:1px solid #30252c;background:transparent;color:#30252c;font-size:10px;cursor:pointer}.author-follow-button:hover,.author-follow-button[aria-pressed="true"]{background:#30252c;color:#fff}.author-follow-button:disabled{opacity:.6;cursor:wait}.author-follow-login{font-size:10px;color:#77716a}.author-follow-login a{color:#796747;text-decoration:underline}.author-follow-error{color:#863d32;font-size:9px}`;

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
      <style>{styles}</style>
      <button className="author-follow-button" type="button" disabled={busy} aria-pressed={following} onClick={toggleFollow}>
        {busy ? t.savingChanges : following ? t.unfollowAuthor : t.followAuthor}
      </button>
      {error && <span className="author-follow-error" role="status">{error}</span>}
    </div>
  );
}
