import express from "express";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import AuthorProfile from "./auth/author-profile.model.js";
import Book from "./books/book.model.js";
import Category from "./books/category.model.js";
import BlogPost from "./cms/blog-post.model.js";
import CmsPage from "./cms/cms-page.model.js";

const dist = new URL("../../../client/dist/", import.meta.url);
const templatePath = new URL("index.html", dist);
const routes = {
  books: { model: Book, key: "catalogueId", title: "title", description: "description" },
  categories: { model: Category, key: "key", title: "labels", description: "descriptions", filter: { active: true } },
  authors: { model: AuthorProfile, key: "slug", title: "authorName", description: "biography", filter: { status: "active" } },
  blog: { model: BlogPost, key: "slug", title: "title", description: "summary", filter: { status: "published" }, editorial: true, type: "article" },
  pages: { model: CmsPage, key: "slug", title: "title", description: "body", filter: { status: "published" }, editorial: true },
};
const defaultTitle = "Rasbhav Books";
const defaultDescription = "Discover Indian stories and independent authors at Rasbhav Books.";

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function preferredText(value) {
  if (typeof value === "string") return value.trim();
  return value?.en?.trim() || value?.gu?.trim() || value?.hi?.trim() || "";
}

function renderHead(template, { title, description, type = "website", canonical, noIndex }) {
  const tags = [
    "<title>" + escapeHtml(title) + "</title>",
    '<meta name="description" content="' + escapeHtml(description) + '">',
    '<meta property="og:title" content="' + escapeHtml(title) + '">',
    '<meta property="og:description" content="' + escapeHtml(description) + '">',
    '<meta property="og:type" content="' + escapeHtml(type) + '">',
    '<meta name="twitter:title" content="' + escapeHtml(title) + '">',
    '<meta name="twitter:description" content="' + escapeHtml(description) + '">',
  ];
  if (canonical) {
    const url = escapeHtml(canonical);
    tags.push('<link rel="canonical" href="' + url + '">', '<meta property="og:url" content="' + url + '">');
  }
  if (noIndex) tags.push('<meta name="robots" content="noindex">');
  return template
    .replace(/<title>[^<]*<\/title>/i, "")
    .replace(/<meta (?:name="(?:description|twitter:title|twitter:description)"|property="og:(?:title|description|type)")[^>]*>/gi, "")
    .replace(/<\/head>/i, () => tags.join("\n") + "\n</head>");
}

export function mountFrontendHtml(app) {
  const frontendPaths = /^\/(?!api(?:\/|$)|assets(?:\/|$))[^.]*$/i;
  app.use("/assets", express.static(fileURLToPath(new URL("assets/", dist)), { index: false, immutable: true, maxAge: "1y" }));
  app.get(frontendPaths, async (request, response) => {
    const segments = request.path.split("/").filter(Boolean);
    const resource = segments.length === 2 && Object.hasOwn(routes, segments[0]) ? routes[segments[0]] : null;
    const isPublicRoot = segments.length === 0 || segments.length === 1 && ["blog", "community"].includes(segments[0]);
    const isCheckout = segments[0] === "books" && request.query.checkout === "preview";
    let status = 200;
    let metadata = { title: defaultTitle, description: defaultDescription, noIndex: !isPublicRoot };
    if (isPublicRoot) metadata.canonical = env.appBaseUrl + (segments.length ? "/" + segments[0] : "/");
    if (resource && !isCheckout) {
      const key = decodeURIComponent(segments[1]);
      if (mongoose.connection.readyState !== 1) {
        status = 503;
      } else {
        const projection = [resource.title, resource.description, ...(resource.editorial ? ["seoTitle", "seoDescription"] : [])];
        const item = await resource.model.findOne({ ...resource.filter, [resource.key]: key }).select(projection.join(" ")).lean();
        if (item) {
          const title = preferredText(item.seoTitle) || preferredText(item[resource.title]);
          metadata = {
            title: title ? title + " | " + defaultTitle : defaultTitle,
            description: (preferredText(item.seoDescription) || preferredText(item[resource.description]) || defaultDescription).slice(0, 300),
            type: resource.type,
            canonical: env.appBaseUrl + "/" + segments[0] + "/" + encodeURIComponent(key),
          };
        } else status = 404;
      }
    }
    const template = await readFile(templatePath, "utf8");
    response.set("Cache-Control", "no-store");
    if (metadata.noIndex) response.set("X-Robots-Tag", "noindex");
    return response.status(status).type("html").send(renderHead(template, metadata));
  });
}
