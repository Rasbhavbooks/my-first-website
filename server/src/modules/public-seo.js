import mongoose from "mongoose";
import { env } from "../config/env.js";
import AuthorProfile from "./auth/author-profile.model.js";
import Book from "./books/book.model.js";
import Category from "./books/category.model.js";
import BlogPost from "./cms/blog-post.model.js";
import CmsPage from "./cms/cms-page.model.js";

const MAX_PER_COLLECTION = 9999;
const sources = [
  { model: Book, field: "catalogueId", prefix: "/books", filter: {} },
  { model: Category, field: "key", prefix: "/categories", filter: { active: true } },
  { model: AuthorProfile, field: "slug", prefix: "/authors", filter: { status: "active" } },
  { model: BlogPost, field: "slug", prefix: "/blog", filter: { status: "published" } },
  { model: CmsPage, field: "slug", prefix: "/pages", filter: { status: "published" } },
];

function escapeXml(value) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character]);
}

export function serveRobots(_request, response) {
  response.type("text/plain").send([
    "User-agent: *",
    "Disallow: /api/",
    "Disallow: /admin/",
    "Disallow: /account",
    "Disallow: /author/studio",
    "Disallow: /author/books",
    "Disallow: /library",
    "Disallow: /read/",
    "Sitemap: " + env.appBaseUrl + "/sitemap.xml",
    "",
  ].join("\n"));
}

export async function serveSitemap(_request, response) {
  if (mongoose.connection.readyState !== 1) {
    return response.set("Cache-Control", "no-store").status(503).type("text/plain").send("Sitemap temporarily unavailable.");
  }
  const lists = await Promise.all(sources.map(async ({ model, field, prefix, filter }) => {
    const records = await model.find(filter).select(field + " -_id")
      .sort({ [field]: 1 }).limit(MAX_PER_COLLECTION).lean();
    return records.filter(record => typeof record[field] === "string" && record[field])
      .map(record => prefix + "/" + encodeURIComponent(record[field]));
  }));
  const paths = ["/", "/blog", ...lists.flat()];
  const xml = paths.map(path => "  <url><loc>" + escapeXml(env.appBaseUrl + path) + "</loc></url>").join("\n");
  return response.type("application/xml").send(
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + xml + "\n</urlset>\n",
  );
}
