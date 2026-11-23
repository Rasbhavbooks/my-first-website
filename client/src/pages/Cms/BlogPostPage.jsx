import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useLanguage } from "../../hooks/useLanguage.js";
import { getPublishedBlogPost } from "../../services/blogService.js";
import { usePageMetadata } from "../../hooks/usePageMetadata.js";

const styles = `
.blog-post{max-width:850px;min-height:70vh;margin:auto;padding:64px 22px 100px}
.blog-post h1{margin:16px 0 14px;color:#30252c;font:500 clamp(38px,6vw,60px)/1.1 var(--serif)}
.blog-post-summary{color:#77716a;font-size:15px;line-height:1.8}
.blog-post-body{margin-top:30px;color:#514a44;font-size:14px;line-height:2;white-space:pre-wrap;overflow-wrap:anywhere}
.blog-post-state{padding:44px 0;color:#77716a}
`;

export default function BlogPostPage() {
  const { slug } = useParams();
  const { language, t } = useLanguage();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getPublishedBlogPost(slug)
      .then((result) => { if (active) { setPost(result); setMissing(false); } })
      .catch((error) => { if (active) { setPost(null); setMissing(error.status === 404); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  usePageMetadata({
    title: post ? post.seoTitle?.[language] || post.title?.[language] || post.title?.en || "Rasbhav Books" : "",
    description: post ? post.seoDescription?.[language] || post.summary?.[language] || post.summary?.en || "" : "",
    type: "article",
  });


  return (
    <main className="blog-post">
      <style>{styles}</style>
      {loading && <p className="blog-post-state">{t.loading}</p>}
      {!loading && missing && <div className="blog-post-state"><h1>{t.blogPostNotFound}</h1><Link to="/blog">{t.blogBackToList}</Link></div>}
      {!loading && !missing && !post && <p className="blog-post-state" role="alert">{t.blogPostUnavailable}</p>}
      {post && <>
        <Link to="/blog">{t.blogBackToList}</Link>
        <div className="eyebrow"><i />{t.community}</div>
        {post.publishedAt && <time dateTime={post.publishedAt}>{new Date(post.publishedAt).toLocaleDateString(language)}</time>}
        <h1>{post.title?.[language] || post.title?.en}</h1>
        <p className="blog-post-summary">{post.summary?.[language] || post.summary?.en}</p>
        <div className="blog-post-body">{post.body?.[language] || post.body?.en}</div>
      </>}
    </main>
  );
}
