import { isDatabaseConnected } from "../../config/database.js";
import BlogPost from "./blog-post.model.js";

const LANGUAGES = ["en", "gu", "hi"];

function errorResponse(response, status, code, message) {
  return response.status(status).json({ error: { code, message } });
}

function localizedGroup(value, maxLength) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const group = {};
  for (const language of LANGUAGES) {
    const field = value[language] ?? "";
    if (typeof field !== "string" || field.length > maxLength) return null;
    group[language] = field.trim();
  }
  return group;
}

function normalizeFields(body) {
  const title = localizedGroup(body?.title, 200);
  const summary = localizedGroup(body?.summary, 600);
  const content = localizedGroup(body?.body, 20000);
  const seoTitle = localizedGroup(body?.seoTitle ?? {}, 70);
  const seoDescription = localizedGroup(body?.seoDescription ?? {}, 320);
  if (!title || !summary || !content || !seoTitle || !seoDescription) return null;
  return { title, summary, body: content, seoTitle, seoDescription };
}

function validForPublish(fields) {
  return LANGUAGES.every((language) => fields.title[language].length >= 2
    && fields.summary[language].length >= 20
    && fields.body[language].length >= 40);
}

function adminDto(post) {
  return {
    slug: post.slug, title: post.title, summary: post.summary, body: post.body,
    seoTitle: post.seoTitle, seoDescription: post.seoDescription,
    status: post.status, publishedAt: post.publishedAt, createdAt: post.createdAt, updatedAt: post.updatedAt,
  };
}

function publicDto(post, includeBody = false) {
  return {
    slug: post.slug, title: post.title, summary: post.summary,
    ...(includeBody ? { body: post.body } : {}),
    seoTitle: post.seoTitle, seoDescription: post.seoDescription,
    publishedAt: post.publishedAt, updatedAt: post.updatedAt,
  };
}

export async function listPublishedBlogPosts(_request, response) {
  if (!isDatabaseConnected()) return errorResponse(response, 503, "DATABASE_UNAVAILABLE", "Blog posts are temporarily unavailable.");
  const posts = await BlogPost.find({ status: "published" })
    .select("slug title summary seoTitle seoDescription publishedAt updatedAt")
    .sort({ publishedAt: -1, _id: -1 })
    .limit(50)
    .lean();
  response.setHeader("Cache-Control", "public, max-age=60");
  return response.json({ data: { posts: posts.map((post) => publicDto(post)) } });
}

export async function getPublishedBlogPost(request, response) {
  if (!isDatabaseConnected()) return errorResponse(response, 503, "DATABASE_UNAVAILABLE", "This blog post is temporarily unavailable.");
  const post = await BlogPost.findOne({ slug: request.params.slug, status: "published" }).lean();
  if (!post) return errorResponse(response, 404, "BLOG_POST_NOT_FOUND", "Blog post not found.");
  response.setHeader("Cache-Control", "public, max-age=60");
  return response.json({ data: { post: publicDto(post, true) } });
}

export async function listAdminBlogPosts(_request, response) {
  const posts = await BlogPost.find()
    .select("slug title summary status publishedAt createdAt updatedAt")
    .sort({ updatedAt: -1, _id: -1 })
    .limit(100)
    .lean();
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { posts: posts.map((post) => adminDto(post)) } });
}

export async function createBlogPost(request, response) {
  const slug = typeof request.body?.slug === "string" ? request.body.slug.trim().toLowerCase() : "";
  const status = request.body?.status === undefined ? "draft" : request.body.status;
  const fields = normalizeFields(request.body);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100 || !fields || !["draft", "published"].includes(status)) {
    return errorResponse(response, 400, "INVALID_BLOG_POST", "Check the post URL, translations, and status.");
  }
  if (status === "published" && !validForPublish(fields)) {
    return errorResponse(response, 400, "BLOG_POST_TRANSLATIONS_REQUIRED", "Add a title, 20-character summary, and 40-character article in all three languages before publishing.");
  }
  try {
    const post = await BlogPost.create({
      slug, ...fields, status, publishedAt: status === "published" ? new Date() : null, updatedBy: request.reader._id,
    });
    response.setHeader("Cache-Control", "no-store");
    return response.status(201).json({ data: { post: adminDto(post) } });
  } catch (error) {
    if (error?.code === 11000) return errorResponse(response, 409, "BLOG_POST_EXISTS", "That blog URL is already in use.");
    if (error?.name === "ValidationError") return errorResponse(response, 400, "INVALID_BLOG_POST", "Check the post URL and translations.");
    throw error;
  }
}

export async function updateBlogPost(request, response) {
  const fields = normalizeFields(request.body);
  const status = request.body?.status;
  if (!fields || (status !== undefined && !["draft", "published"].includes(status))) {
    return errorResponse(response, 400, "INVALID_BLOG_POST", "Check the translations and status.");
  }
  const post = await BlogPost.findOne({ slug: request.params.slug });
  if (!post) return errorResponse(response, 404, "BLOG_POST_NOT_FOUND", "Blog post not found.");
  const nextStatus = status ?? post.status;
  if (nextStatus === "published" && !validForPublish(fields)) {
    return errorResponse(response, 400, "BLOG_POST_TRANSLATIONS_REQUIRED", "Add a title, 20-character summary, and 40-character article in all three languages before publishing.");
  }
  post.title = fields.title;
  post.summary = fields.summary;
  post.body = fields.body;
  post.seoTitle = fields.seoTitle;
  post.seoDescription = fields.seoDescription;
  post.status = nextStatus;
  post.publishedAt = nextStatus === "published" ? (post.publishedAt || new Date()) : null;
  post.updatedBy = request.reader._id;
  await post.save();
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { post: adminDto(post) } });
}
