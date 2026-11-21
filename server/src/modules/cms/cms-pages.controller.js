import { isDatabaseConnected } from "../../config/database.js";
import CmsPage from "./cms-page.model.js";

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

function validForPublish(fields) {
  return LANGUAGES.every((language) => fields.title[language].length >= 2 && fields.body[language].length >= 20);
}

function normalizeFields(body) {
  const title = localizedGroup(body?.title, 200);
  const content = localizedGroup(body?.body, 20000);
  const seoTitle = localizedGroup(body?.seoTitle ?? {}, 70);
  const seoDescription = localizedGroup(body?.seoDescription ?? {}, 320);
  if (!title || !content || !seoTitle || !seoDescription) return null;
  return { title, body: content, seoTitle, seoDescription };
}

function adminDto(page) {
  return {
    slug: page.slug,
    title: page.title,
    body: page.body,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    status: page.status,
    publishedAt: page.publishedAt,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  };
}

function publicDto(page) {
  return {
    slug: page.slug,
    title: page.title,
    body: page.body,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    updatedAt: page.updatedAt,
  };
}

export async function listPublishedCmsPages(_request, response) {
  if (!isDatabaseConnected()) return errorResponse(response, 503, "DATABASE_UNAVAILABLE", "Pages are temporarily unavailable.");
  const pages = await CmsPage.find({ status: "published" })
    .select("slug title seoTitle seoDescription updatedAt")
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();
  response.setHeader("Cache-Control", "public, max-age=60");
  return response.json({ data: { pages } });
}

export async function getPublishedCmsPage(request, response) {
  if (!isDatabaseConnected()) return errorResponse(response, 503, "DATABASE_UNAVAILABLE", "This page is temporarily unavailable.");
  const page = await CmsPage.findOne({ slug: request.params.slug, status: "published" }).lean();
  if (!page) return errorResponse(response, 404, "PAGE_NOT_FOUND", "Page not found.");
  response.setHeader("Cache-Control", "public, max-age=60");
  return response.json({ data: { page: publicDto(page) } });
}

export async function listAdminCmsPages(_request, response) {
  const pages = await CmsPage.find()
    .select("slug title seoTitle seoDescription status publishedAt createdAt updatedAt")
    .sort({ updatedAt: -1, _id: -1 })
    .limit(100)
    .lean();
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { pages: pages.map(adminDto) } });
}

export async function createCmsPage(request, response) {
  const slug = typeof request.body?.slug === "string" ? request.body.slug.trim().toLowerCase() : "";
  const status = request.body?.status === undefined ? "draft" : request.body.status;
  const fields = normalizeFields(request.body);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100 || !fields || !["draft", "published"].includes(status)) {
    return errorResponse(response, 400, "INVALID_CMS_PAGE", "Check the page URL, translations, and status.");
  }
  if (status === "published" && !validForPublish(fields)) {
    return errorResponse(response, 400, "CMS_PAGE_TRANSLATIONS_REQUIRED", "Add a title and at least 20 body characters in all three languages before publishing.");
  }
  try {
    const page = await CmsPage.create({
      slug, ...fields, status, publishedAt: status === "published" ? new Date() : null, updatedBy: request.reader._id,
    });
    response.setHeader("Cache-Control", "no-store");
    return response.status(201).json({ data: { page: adminDto(page) } });
  } catch (error) {
    if (error?.code === 11000) return errorResponse(response, 409, "CMS_PAGE_EXISTS", "That page URL is already in use.");
    if (error?.name === "ValidationError") return errorResponse(response, 400, "INVALID_CMS_PAGE", "Check the page URL, translations, and status.");
    throw error;
  }
}

export async function updateCmsPage(request, response) {
  const fields = normalizeFields(request.body);
  const status = request.body?.status;
  if (!fields || (status !== undefined && !["draft", "published"].includes(status))) {
    return errorResponse(response, 400, "INVALID_CMS_PAGE", "Check the translations and status.");
  }
  const page = await CmsPage.findOne({ slug: request.params.slug });
  if (!page) return errorResponse(response, 404, "CMS_PAGE_NOT_FOUND", "Page not found.");
  const nextStatus = status ?? page.status;
  if (nextStatus === "published" && !validForPublish(fields)) {
    return errorResponse(response, 400, "CMS_PAGE_TRANSLATIONS_REQUIRED", "Add a title and at least 20 body characters in all three languages before publishing.");
  }
  page.title = fields.title;
  page.body = fields.body;
  page.seoTitle = fields.seoTitle;
  page.seoDescription = fields.seoDescription;
  page.status = nextStatus;
  page.publishedAt = nextStatus === "published" ? (page.publishedAt || new Date()) : null;
  page.updatedBy = request.reader._id;
  await page.save();
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { page: adminDto(page) } });
}
