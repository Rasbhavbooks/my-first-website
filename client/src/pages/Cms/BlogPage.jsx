import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useLanguage } from "../../hooks/useLanguage.js";
import { getPublishedBlogPosts } from "../../services/blogService.js";

const styles = `
.blog-page{max-width:1100px;min-height:70vh;margin:auto;padding:60px 22px 96px}
.blog-page h1{margin:16px 0;color:#30252c;font:500 clamp(38px,6vw,60px)/1.1 var(--serif)}
.blog-intro{max-width:660px;color:#77716a;font-size:13px;line-height:1.8}
.blog-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-top:30px}
.blog-card{padding:22px;border:1px solid #e4ddd1;background:#fffdfa}
.blog-card h2{margin:8px 0 12px;color:#30252c;font:500 25px/1.2 var(--serif)}
.blog-card p{color:#77716a;font-size:12px;line-height:1.8;white-space:pre-wrap}
.blog-card time{color:#8a8379;font-size:10px}
.blog-read{display:inline-block;margin-top:12px;color:#796747;font-size:11px}
.blog-state{padding:28px 0;color:#77716a}
`;

export default function BlogPage() {
  const { language, t } = useLanguage();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    getPublishedBlogPosts().then((result) => {
      if (active) { setPosts(result); setError(false); }
    }).catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <main className="blog-page">
      <style>{styles}</style>
      <div className="eyebrow"><i />{t.community}</div>
      <h1>{t.blogPublicTitle}</h1>
      <p className="blog-intro">{t.blogPublicIntro}</p>
      {loading && <p className="blog-state">{t.loading}</p>}
      {error && <p className="blog-state" role="alert">{t.blogPostUnavailable}</p>}
      {!loading && !error && !posts.length && <p className="blog-state">{t.blogNoPosts}</p>}
      <div className="blog-grid">
        {posts.map((post) => <article className="blog-card" key={post.slug}>
          {post.publishedAt && <time dateTime={post.publishedAt}>{new Date(post.publishedAt).toLocaleDateString(language)}</time>}
          <h2><Link to={`/blog/${encodeURIComponent(post.slug)}`}>{post.title?.[language] || post.title?.en}</Link></h2>
          <p>{post.summary?.[language] || post.summary?.en}</p>
          <Link className="blog-read" to={`/blog/${encodeURIComponent(post.slug)}`}>{t.blogReadMore} ↗</Link>
        </article>)}
      </div>
    </main>
  );
}
