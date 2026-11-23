import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useLanguage } from "../../hooks/useLanguage.js";
import { getPublishedCmsPage } from "../../services/cmsPageService.js";
import { usePageMetadata } from "../../hooks/usePageMetadata.js";

const styles = `
.cms-page{max-width:850px;min-height:70vh;margin:auto;padding:64px 22px 100px}
.cms-page h1{margin:16px 0 26px;color:#30252c;font:500 clamp(38px,6vw,60px)/1.1 var(--serif)}
.cms-page-body{color:#514a44;font-size:14px;line-height:2;white-space:pre-wrap;overflow-wrap:anywhere}
.cms-page-error{padding:48px 0;text-align:center;color:#77716a}
.cms-page-error a{color:#796747}
`;

export default function CmsPageView() {
  const { slug } = useParams();
  const { language, t } = useLanguage();
  const [page, setPage] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let active = true;
    getPublishedCmsPage(slug)
      .then((result) => { if (active) { setPage(result); setMissing(false); } })
      .catch(() => { if (active) { setPage(null); setMissing(true); } });
    return () => { active = false; };
  }, [slug]);

  usePageMetadata({
    title: page ? page.seoTitle?.[language] || page.title?.[language] || page.title?.en || "Rasbhav Books" : "",
    description: page ? page.seoDescription?.[language] || "" : "",
    type: "website",
  });


  if (missing) return <main className="cms-page"><style>{styles}</style><div className="cms-page-error"><h1>{t.pageNotFound}</h1><Link to="/">{t.backHome}</Link></div></main>;
  if (!page) return <main className="cms-page"><p>{t.loading}</p></main>;
  return (
    <main className="cms-page">
      <style>{styles}</style>
      <div className="eyebrow"><i />{t.community}</div>
      <h1>{page.title[language] || page.title.en}</h1>
      <div className="cms-page-body">{page.body[language] || page.body.en}</div>
    </main>
  );
}
