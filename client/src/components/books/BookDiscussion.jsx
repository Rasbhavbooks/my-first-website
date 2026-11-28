import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";

const labels = {
  gu: { replies: "જવાબો", reply: "તમારો જવાબ લખો", title: "પુસ્તક ચર્ચા", empty: "હજી ચર્ચામાં કોઈ નોંધ નથી.", body: "તમારો વિચાર લખો", help: "૧૦થી ૧૦૦૦ અક્ષર લખો. નોંધ જાહેર થાય એ પહેલાં એડમિન તેની સમીક્ષા કરશે.", send: "સમીક્ષા માટે મોકલો", pending: "તમારી નોંધ સમીક્ષા માટે મોકલાઈ.", report: "રિપોર્ટ કરો", reported: "રિપોર્ટ નોંધાયો.", admin: "પુસ્તક ચર્ચાની સમીક્ષા", approve: "જાહેર રાખો", hide: "છુપાવો", queueEmpty: "સમીક્ષા માટે કોઈ નોંધ નથી.", more: "વધુ નોંધ", error: "વિનંતી પૂરી થઈ શકી નહીં. ફરી પ્રયાસ કરો.", loading: "લોડ થઈ રહ્યું છે…" },
  hi: { replies: "जवाब", reply: "अपना जवाब लिखें", title: "पुस्तक चर्चा", empty: "चर्चा में अभी कोई पोस्ट नहीं है।", body: "अपना विचार लिखें", help: "10 से 1,000 अक्षर लिखें। प्रकाशन से पहले एडमिन इसकी समीक्षा करेगा।", send: "समीक्षा के लिए भेजें", pending: "आपकी पोस्ट समीक्षा के लिए भेजी गई।", report: "रिपोर्ट करें", reported: "रिपोर्ट दर्ज हुई।", admin: "पुस्तक चर्चा की समीक्षा", approve: "सार्वजनिक रखें", hide: "छिपाएँ", queueEmpty: "समीक्षा के लिए कोई पोस्ट नहीं है।", more: "और पोस्ट", error: "अनुरोध पूरा नहीं हुआ। फिर कोशिश करें।", loading: "लोड हो रहा है…" },
  en: { replies: "Replies", reply: "Write a reply", title: "Book discussion", empty: "There are no posts yet.", body: "Share your thoughts", help: "Write 10 to 1,000 characters. An admin reviews posts before they appear.", send: "Send for review", pending: "Your post was submitted for review.", report: "Report post", reported: "Report received.", admin: "Moderate book discussions", approve: "Make public or keep visible", hide: "Hide post", queueEmpty: "There are no posts to review.", more: "More posts", error: "Could not complete the request. Try again.", loading: "Loading…" },
};

const style = `
.book-discussion{max-width:900px;margin:32px auto;padding:16px 24px;color:#30252c}
.book-discussion form{display:grid;gap:8px;margin:18px 0}.book-discussion textarea{width:100%;min-height:100px;padding:10px;border:1px solid #b8aa97;background:#fff}
.book-discussion ul{padding:0;list-style:none}.book-discussion li{padding:14px 0;border-bottom:1px solid #ded4c9}.book-discussion li p{white-space:pre-wrap;overflow-wrap:anywhere}
.book-discussion button{padding:8px 12px;border:1px solid #54464e;background:#fff;color:#30252c;cursor:pointer}.book-discussion button:disabled{opacity:.55;cursor:wait}
.book-discussion .discussion-replies{margin:12px 0 0;padding-left:16px;border-left:2px solid #ded4c9}
.book-discussion .discussion-actions{display:flex;gap:8px;flex-wrap:wrap}
`;

async function discussionRequest(path, method = "GET", body) {
  const response = await fetch(path, {
    credentials: "same-origin", cache: "no-store", method,
    ...(body && { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error("Discussion request failed.");
  return (await response.json()).data;
}

export function BookDiscussion({ bookId }) {
  const endpoint = "/api/v1/books/" + encodeURIComponent(bookId) + "/discussions";
  return <DiscussionFeed endpoint={endpoint} />;
}

function ReplyThread({ post, endpoint, copy }) {
  const [open, setOpen] = useState(false);
  const threadId = "book-discussion-" + post.id;
  return <div className="discussion-replies">
    <button type="button" aria-expanded={open} aria-controls={open ? threadId : undefined} onClick={() => setOpen(value => !value)}>
      {copy.replies}
    </button>
    {open && <DiscussionFeed endpoint={endpoint + "/" + post.id + "/replies"} threadId={threadId} />}
  </div>;
}

function DiscussionFeed({ endpoint, threadId }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const copy = labels[language] ?? labels.en;
  const [page, setPage] = useState(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    discussionRequest(endpoint).then(result => { if (active) setPage(result); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [endpoint]);

  async function act(task) {
    setBusy(true);
    setError(false);
    setNotice("");
    try { await task(); } catch { setError(true); } finally { setBusy(false); }
  }

  const prefix = threadId || "book-discussion";
  return <section id={threadId} className={threadId ? undefined : "book-discussion"} aria-labelledby={prefix + "-title"}>
    {threadId ? <h3 id={prefix + "-title"}>{copy.replies}</h3> : <>
      <style>{style}</style>
      <h2 id={prefix + "-title"}>{copy.title}</h2>
    </>}
    {user && <form onSubmit={event => {
      event.preventDefault();
      void act(async () => {
        await discussionRequest(endpoint, "POST", { body });
        setBody("");
        setNotice(copy.pending);
      });
    }}>
      <label htmlFor={prefix + "-body"}>{threadId ? copy.reply : copy.body}</label>
      <textarea id={prefix + "-body"} aria-describedby={prefix + "-help"}
        value={body} onChange={event => setBody(event.target.value)} minLength={10} maxLength={1000} required />
      <small id={prefix + "-help"}>{copy.help}</small>
      <div><button type="submit" disabled={busy}>{copy.send}</button></div>
    </form>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{copy.error}</p>}
    {!page && !error && <p role="status">{copy.loading}</p>}
    {page && !page.posts.length && <p>{copy.empty}</p>}
    {page?.posts.length > 0 && <ul>{page.posts.map(post => <li key={post.id}>
      <strong>{post.authorName}</strong>
      <p>{post.body}</p>
      {user && <button type="button" disabled={busy} onClick={() => act(async () => {
        await discussionRequest(endpoint + "/" + post.id + "/report", "POST");
        setNotice(copy.reported);
      })}>{copy.report}</button>}
      {!threadId && <ReplyThread post={post} endpoint={endpoint} copy={copy} />}
    </li>)}</ul>}
    {page?.nextCursor && <button type="button" disabled={busy} onClick={() => act(async () => {
      const next = await discussionRequest(endpoint + "?cursor=" + encodeURIComponent(page.nextCursor));
      setPage({ posts: [...page.posts, ...next.posts], nextCursor: next.nextCursor });
    })}>{copy.more}</button>}
  </section>;
}

export function AdminDiscussions() {
  const { language } = useLanguage();
  const copy = labels[language] ?? labels.en;
  const endpoint = "/api/v1/admin/discussions";
  const [posts, setPosts] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    discussionRequest(endpoint).then(result => { if (active) setPosts(result.posts); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);

  async function review(post, status) {
    setBusy(true);
    setError(false);
    try {
      await discussionRequest(endpoint + "/" + post.id, "PATCH", { status, updatedAt: post.updatedAt });
      setPosts((await discussionRequest(endpoint)).posts);
    } catch {
      setError(true);
      const latest = await discussionRequest(endpoint).catch(() => null);
      if (latest) setPosts(latest.posts);
    } finally {
      setBusy(false);
    }
  }

  return <main className="book-discussion">
    <style>{style}</style>
    <h1>{copy.admin}</h1>
    {error && <p role="alert">{copy.error}</p>}
    {!posts && !error && <p role="status">{copy.loading}</p>}
    {posts?.length === 0 && <p>{copy.queueEmpty}</p>}
    {posts?.length > 0 && <ul>{posts.map(post => <li key={post.id}>
      <strong>{post.authorName} · {post.bookId}{post.parentId ? " · " + copy.replies : ""}</strong>
      <p>{post.body}</p>
      <div className="discussion-actions">
        <button type="button" disabled={busy} onClick={() => review(post, "approved")}>{copy.approve}</button>
        <button type="button" disabled={busy} onClick={() => review(post, "hidden")}>{copy.hide}</button>
      </div>
    </li>)}</ul>}
  </main>;
}
