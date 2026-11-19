import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { getBookTitle } from "../../data/books.js";
import AuthorFollowButton from "../../components/books/AuthorFollowButton.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { getPublicAuthorProfile } from "../../services/authorService.js";

const styles = `
.public-author{max-width:1000px;min-height:70vh;margin:auto;padding:62px 22px 90px}
.public-author-branding{position:relative;height:250px;margin-bottom:54px;background:#e9e3d9;overflow:hidden}
.public-author-cover{width:100%;height:100%;object-fit:cover}
.public-author-avatar{position:absolute;left:28px;bottom:-35px;width:112px;height:112px;border:5px solid #f6f3ee;border-radius:50%;object-fit:cover;background:#fffdfa}
@media(max-width:600px){.public-author-branding{height:170px;margin-bottom:48px}.public-author-avatar{left:18px;width:92px;height:92px}}
.public-author h1{font:500 clamp(38px,6vw,60px)/1.05 var(--serif);color:#30252c}
.public-author-bio{max-width:720px;color:#68615a;font-size:13px;line-height:2;white-space:pre-wrap}
.public-author-meta{color:#897e70;font-size:10px;letter-spacing:.7px;text-transform:uppercase}
.public-author-links{display:flex;gap:18px;margin:20px 0}
.public-author-links a{color:#796747;text-decoration:underline;font-size:11px}
.public-author-books{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:34px}
.public-author-book{padding:20px;border:1px solid #e4ddd1;background:#fffdfa}
.public-author-book a{color:#30252c;text-decoration:none}
.public-author-book h2{font:500 21px var(--serif)}
.public-author-book p{color:#77716a;font-size:11px;line-height:1.6}
.public-author-error{padding:40px;text-align:center;color:#77716a}
`;

export default function PublicAuthorPage() {
  const { slug } = useParams();
  const { language, t } = useLanguage();
  const [data, setData] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let active = true;
    getPublicAuthorProfile(slug)
      .then((result) => { if (active) { setData(result); setMissing(false); } })
      .catch(() => { if (active) { setData(null); setMissing(true); } });
    return () => { active = false; };
  }, [slug]);

  if (missing) return <main className="public-author"><style>{styles}</style><div className="public-author-error"><h1>{t.authorNotFound}</h1><Link to="/">{t.backHome}</Link></div></main>;
  if (!data) return <main className="public-author"><p>{t.loading}</p></main>;

  const { author, books } = data;
  return (
    <main className="public-author">
      <style>{styles}</style>
      {(author.coverImageUrl || author.profilePhotoUrl) && (
        <div className="public-author-branding">
          {author.coverImageUrl && <img className="public-author-cover" src={author.coverImageUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />}
          {author.profilePhotoUrl && <img className="public-author-avatar" src={author.profilePhotoUrl} alt={author.authorName} loading="lazy" decoding="async" referrerPolicy="no-referrer" />}
        </div>
      )}
      <div className="eyebrow"><i />{t.forAuthors}</div>
      <h1>{author.authorName}</h1>
      <p className="public-author-meta">{author.writingLanguages.join(" · ")}{author.genres.length ? ` · ${author.genres.join(" · ")}` : ""}</p>
      <p className="public-author-meta">{author.followerCount || 0} {t.authorFollowers}</p>
      <AuthorFollowButton authorSlug={author.slug} authorName={author.followName || author.authorName} />
      <p className="public-author-bio">{author.biography}</p>
      <div className="public-author-links">
        {author.websiteUrl && <a href={author.websiteUrl} target="_blank" rel="noreferrer">{t.authorWebsite}</a>}
        {author.writingSampleUrl && <a href={author.writingSampleUrl} target="_blank" rel="noreferrer">{t.writingSampleUrl}</a>}
      </div>
      <h2>{t.authorBooks}</h2>
      {books.length ? <div className="public-author-books">{books.map((book) => (
        <article className="public-author-book" key={book.id}>
          <Link to={`/books/${encodeURIComponent(book.id)}`}><h2>{getBookTitle(book, language)}</h2></Link>
          <p>{t.by} {book.author}</p>
          <p>{t.categories[book.category] || book.category} · {book.language}</p>
        </article>
      ))}</div> : <p>{t.noResults}</p>}
    </main>
  );
}
