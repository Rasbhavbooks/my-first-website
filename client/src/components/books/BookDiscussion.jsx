import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";

const labels = {
  gu: { like: "ગમ્યું", unlike: "લાઇક દૂર કરો", replies: "જવાબો", reply: "તમારો જવાબ લખો", title: "પુસ્તક ચર્ચા", empty: "હજી ચર્ચામાં કોઈ નોંધ નથી.", body: "તમારો વિચાર લખો", help: "૧૦થી ૧૦૦૦ અક્ષર લખો. નોંધ જાહેર થાય એ પહેલાં એડમિન તેની સમીક્ષા કરશે.", send: "સમીક્ષા માટે મોકલો", pending: "તમારી નોંધ સમીક્ષા માટે મોકલાઈ.", report: "રિપોર્ટ કરો", reported: "રિપોર્ટ નોંધાયો.", admin: "પુસ્તક ચર્ચાની સમીક્ષા", approve: "જાહેર રાખો", hide: "છુપાવો", queueEmpty: "સમીક્ષા માટે કોઈ નોંધ નથી.", more: "વધુ નોંધ", error: "વિનંતી પૂરી થઈ શકી નહીં. ફરી પ્રયાસ કરો.", loading: "લોડ થઈ રહ્યું છે…" },
  hi: { like: "पसंद", unlike: "पसंद हटाएँ", replies: "जवाब", reply: "अपना जवाब लिखें", title: "पुस्तक चर्चा", empty: "चर्चा में अभी कोई पोस्ट नहीं है।", body: "अपना विचार लिखें", help: "10 से 1,000 अक्षर लिखें। प्रकाशन से पहले एडमिन इसकी समीक्षा करेगा।", send: "समीक्षा के लिए भेजें", pending: "आपकी पोस्ट समीक्षा के लिए भेजी गई।", report: "रिपोर्ट करें", reported: "रिपोर्ट दर्ज हुई।", admin: "पुस्तक चर्चा की समीक्षा", approve: "सार्वजनिक रखें", hide: "छिपाएँ", queueEmpty: "समीक्षा के लिए कोई पोस्ट नहीं है।", more: "और पोस्ट", error: "अनुरोध पूरा नहीं हुआ। फिर कोशिश करें।", loading: "लोड हो रहा है…" },
  en: { like: "Like", unlike: "Remove like", replies: "Replies", reply: "Write a reply", title: "Book discussion", empty: "There are no posts yet.", body: "Share your thoughts", help: "Write 10 to 1,000 characters. An admin reviews posts before they appear.", send: "Send for review", pending: "Your post was submitted for review.", report: "Report post", reported: "Report received.", admin: "Moderate book discussions", approve: "Make public or keep visible", hide: "Hide post", queueEmpty: "There are no posts to review.", more: "More posts", error: "Could not complete the request. Try again.", loading: "Loading…" },
};

const moderationLabels = {
  gu: { guidelines: "પુસ્તક વિશે સૌજન્યથી વાત કરો. સ્પામ, અપમાન કે કોઈની ખાનગી માહિતી શેર ન કરો.", reason: "રિપોર્ટનું કારણ", cancel: "રદ કરો", reasons: { spam: "સ્પામ", abuse: "અપમાન અથવા સતામણી", personal_information: "ખાનગી માહિતી", other: "અન્ય" } },
  hi: { guidelines: "किताब पर सम्मान से चर्चा करें। स्पैम, अपमान या किसी की निजी जानकारी साझा न करें।", reason: "रिपोर्ट का कारण", cancel: "रद्द करें", reasons: { spam: "स्पैम", abuse: "अपमान या उत्पीड़न", personal_information: "निजी जानकारी", other: "अन्य" } },
  en: { guidelines: "Discuss the book respectfully. Avoid spam, harassment, and sharing anyone’s private information.", reason: "Reason for reporting", cancel: "Cancel", reasons: { spam: "Spam", abuse: "Harassment or abuse", personal_information: "Private information", other: "Other" } },
};

const blockLabels = {
  gu: { block: "આ વાચકની નોંધો છુપાવો", title: "છુપાવેલા વાચકો", unblock: "ફરી બતાવો", empty: "કોઈ વાચક છુપાવેલો નથી." },
  hi: { block: "इस पाठक की पोस्ट छिपाएँ", title: "छिपाए गए पाठक", unblock: "फिर दिखाएँ", empty: "कोई पाठक छिपाया नहीं गया है।" },
  en: { block: "Hide this reader’s posts", title: "Hidden readers", unblock: "Show again", empty: "No readers are hidden." },
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
  const [revision, setRevision] = useState(0);
  return <DiscussionFeed key={revision} endpoint={endpoint} onBlocksChanged={() => setRevision(value => value + 1)} />;
}

function ReplyThread({ post, endpoint, copy, onBlocksChanged }) {
  const [open, setOpen] = useState(false);
  const threadId = "book-discussion-" + post.id;
  return <div className="discussion-replies">
    <button type="button" aria-expanded={open} aria-controls={open ? threadId : undefined} onClick={() => setOpen(value => !value)}>
      {copy.replies}
    </button>
    {open && <DiscussionFeed endpoint={endpoint + "/" + post.id + "/replies"} threadId={threadId} onBlocksChanged={onBlocksChanged} />}
  </div>;
}

function DiscussionBlocks({ endpoint, copy, onBlocksChanged, errorLabel }) {
  const [blocks, setBlocks] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    discussionRequest(endpoint + "/blocks").then(result => { if (active) setBlocks(result.blocks); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [endpoint, open]);

  async function unblock(id) {
    setBusy(true);
    setError(false);
    try {
      await discussionRequest(endpoint + "/blocks/" + id, "DELETE");
      onBlocksChanged();
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return <details onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{copy.title}</summary>
    {error && <p role="alert">{errorLabel}</p>}
    {blocks?.length === 0 && <p>{copy.empty}</p>}
    {blocks?.length > 0 && <ul>{blocks.map(block => <li key={block.id}>
      {block.displayName || "—"}{" "}
      <button type="button" disabled={busy} onClick={() => unblock(block.id)}>{copy.unblock}</button>
    </li>)}</ul>}
  </details>;
}

function DiscussionFeed({ endpoint, threadId, onBlocksChanged }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const copy = labels[language] ?? labels.en;
  const moderation = moderationLabels[language] ?? moderationLabels.en;
  const blocks = blockLabels[language] ?? blockLabels.en;
  const feedPath = endpoint + (user ? "?personal=1" : "");
  const [page, setPage] = useState(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState("");
  const [reportTarget, setReportTarget] = useState(null);
  useEffect(() => {
    let active = true;
    discussionRequest(feedPath).then(result => { if (active) setPage(result); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [feedPath]);

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
      <p>{moderation.guidelines}</p>
      {user && <DiscussionBlocks endpoint={endpoint} copy={blocks} errorLabel={copy.error} onBlocksChanged={onBlocksChanged} />}
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
      {user && (reportTarget === post.id ? <form onSubmit={event => {
        event.preventDefault();
        const reason = new FormData(event.currentTarget).get("reason");
        void act(async () => {
          await discussionRequest(endpoint + "/" + post.id + "/report", "POST", { reason });
          setReportTarget(null);
          setNotice(copy.reported);
        });
      }}>
        <label>{moderation.reason}{" "}
          <select name="reason" required defaultValue="">
            <option value="" disabled>—</option>
            {Object.entries(moderation.reasons).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </label>
        <div className="discussion-actions">
          <button type="submit" disabled={busy}>{copy.report}</button>
          <button type="button" disabled={busy} onClick={() => setReportTarget(null)}>{moderation.cancel}</button>
        </div>
      </form> : <button type="button" disabled={busy} onClick={() => setReportTarget(post.id)}>{copy.report}</button>)}
      {user ? <button type="button" disabled={busy} aria-pressed={post.liked} onClick={() => act(async () => {
        const reaction = await discussionRequest(endpoint + "/" + post.id + "/like", post.liked ? "DELETE" : "PUT");
        setPage(current => ({
          ...current,
          posts: current.posts.map(item => item.id === post.id ? { ...item, ...reaction } : item),
        }));
      })}>{post.liked ? copy.unlike : copy.like} · {post.likeCount}</button> : <span>{copy.like} · {post.likeCount}</span>}
      {user && !post.owned && <button type="button" disabled={busy} onClick={() => act(async () => {
        await discussionRequest(endpoint + "/" + post.id + "/block", "POST");
        onBlocksChanged();
      })}>{blocks.block}</button>}
      {!threadId && <ReplyThread post={post} endpoint={endpoint} copy={copy} onBlocksChanged={onBlocksChanged} />}
    </li>)}</ul>}
    {page?.nextCursor && <button type="button" disabled={busy} onClick={() => act(async () => {
      const next = await discussionRequest(feedPath + (user ? "&" : "?") + "cursor=" + encodeURIComponent(page.nextCursor));
      setPage({ posts: [...page.posts, ...next.posts], nextCursor: next.nextCursor });
    })}>{copy.more}</button>}
  </section>;
}

export function AdminDiscussions() {
  const { language } = useLanguage();
  const copy = labels[language] ?? labels.en;
  const moderation = moderationLabels[language] ?? moderationLabels.en;
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
      {Object.keys(post.reportCounts ?? {}).length > 0 && <ul aria-label={moderation.reason}>
        {Object.entries(moderation.reasons).map(([reason, label]) => post.reportCounts[reason] > 0
          ? <li key={reason}>{label} · {post.reportCounts[reason]}</li> : null)}
      </ul>}
      <div className="discussion-actions">
        <button type="button" disabled={busy} onClick={() => review(post, "approved")}>{copy.approve}</button>
        <button type="button" disabled={busy} onClick={() => review(post, "hidden")}>{copy.hide}</button>
      </div>
    </li>)}</ul>}
  </main>;
}
