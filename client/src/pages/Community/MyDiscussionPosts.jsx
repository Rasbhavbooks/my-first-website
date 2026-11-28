import { useEffect, useState } from "react";
import { Link } from "react-router";

const labels = {
  gu: { title: "મારી ચર્ચા નોંધો", empty: "તમે હજુ ચર્ચામાં કોઈ નોંધ મોકલી નથી.", pending: "સમીક્ષા બાકી", approved: "મંજૂર", hidden: "છુપાવેલી", seen: "વાંચેલું ગણો", link: "પુસ્તકની ચર્ચા", more: "વધુ નોંધો", error: "નોંધો મેળવી કે અપડેટ કરી શકાઈ નહીં." },
  hi: { title: "मेरी चर्चा पोस्ट", empty: "आपने अभी कोई चर्चा पोस्ट नहीं भेजी है।", pending: "समीक्षा बाकी", approved: "मंज़ूर", hidden: "छिपाई गई", seen: "पढ़ा हुआ मानें", link: "पुस्तक की चर्चा", more: "और पोस्ट", error: "पोस्ट लोड या अपडेट नहीं हो सकीं।" },
  en: { title: "My discussion posts", empty: "You haven’t submitted a discussion post yet.", pending: "Awaiting review", approved: "Approved", hidden: "Hidden", seen: "Mark as read", link: "Open book discussion", more: "More posts", error: "Could not load or update your posts." },
};
const endpoint = "/api/v1/community/my-discussions";

async function request(path, options) {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...options });
  if (!response.ok) throw new Error("Discussion status request failed.");
  return (await response.json()).data;
}

export function MyDiscussionPosts({ language }) {
  const copy = labels[language] ?? labels.en;
  const [page, setPage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    request(endpoint, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setPage(result); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, []);

  async function act(update) {
    setBusy(true);
    setError(false);
    try {
      await update();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  function markAsRead(post) {
    void act(async () => {
      await request(endpoint + "/" + post.id + "/seen", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionAt: post.decisionAt }),
      });
      setPage(current => ({ ...current, posts: current.posts.map(item =>
        item.id === post.id ? { ...item, unread: false } : item) }));
    });
  }

  function more() {
    void act(async () => {
      const next = await request(endpoint + "?cursor=" + encodeURIComponent(page.nextCursor));
      setPage(current => ({ posts: [...current.posts, ...next.posts], nextCursor: next.nextCursor }));
    });
  }

  return <section aria-labelledby="my-discussion-title">
    <h2 id="my-discussion-title">{copy.title}</h2>
    {error && <p role="alert">{copy.error}</p>}
    {page?.posts.length === 0 && <p>{copy.empty}</p>}
    {page?.posts.length > 0 && <ul>{page.posts.map(post => <li key={post.id}>
      <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{post.body}</p>
      <p><strong>{copy[post.status]}</strong>{" · "}
        <Link to={"/books/" + encodeURIComponent(post.bookId) + "#book-discussion-title"}>{copy.link}</Link>
        {post.unread && <>{" "}<button type="button" disabled={busy} onClick={() => markAsRead(post)}>{copy.seen}</button></>}
      </p>
    </li>)}</ul>}
    {page?.nextCursor && <button type="button" disabled={busy} onClick={more}>{copy.more}</button>}
  </section>;
}
