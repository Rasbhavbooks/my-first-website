import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import MediaAsset from "./media-asset.model.js";
import { scanBuffer } from "../../services/clamav.service.js";
import { deletePrivateObject, getPrivateObject, storePrivateObject } from "../../services/r2-storage.service.js";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const LANGUAGES = ["en", "gu", "hi"];
const MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function errorResponse(response, status, code, message) {
  return response.status(status).json({ error: { code, message } });
}

function validImage(buffer, contentType) {
  if (contentType === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (contentType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (contentType === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

function safeFileName(value, contentType) {
  const extension = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" }[contentType];
  let name = typeof value === "string" ? value : "";
  try { name = decodeURIComponent(name); } catch { /* Sanitize the original name. */ }
  name = name.replaceAll("\\", "/").split("/").pop()
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^\p{L}\p{N} ._()-]/gu, "_")
    .trim().slice(0, 140);
  if (!name || !name.toLowerCase().endsWith(extension)) name = `image${extension}`;
  return name;
}

function localizedAlt(request) {
  const altText = {};
  for (const language of LANGUAGES) {
    const value = request.get(`x-alt-${language}`);
    if (typeof value !== "string" || value.trim().length < 2 || value.trim().length > 300) return null;
    altText[language] = value.trim();
  }
  return altText;
}

function assetDto(asset) {
  return {
    id: String(asset._id),
    fileName: asset.fileName,
    contentType: asset.contentType,
    size: asset.size,
    altText: asset.altText,
    published: asset.published,
    url: asset.published ? `/api/v1/media/${asset.id}` : "",
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  };
}

export async function listAdminMedia(_request, response) {
  const assets = await MediaAsset.find().sort({ createdAt: -1, _id: -1 }).limit(200).lean();
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { assets: assets.map(assetDto) } });
}

export async function uploadAdminMedia(request, response) {
  const buffer = request.body;
  const contentType = (request.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const altText = localizedAlt(request);
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    return errorResponse(response, 413, "INVALID_MEDIA_SIZE", "Choose a non-empty image up to 5 MB.");
  }
  if (!MIME_TYPES.has(contentType) || !validImage(buffer, contentType)) {
    return errorResponse(response, 400, "INVALID_MEDIA_TYPE", "Choose a valid JPEG, PNG, or WebP image.");
  }
  if (!altText) return errorResponse(response, 400, "MEDIA_ALT_REQUIRED", "Add image descriptions in Gujarati, Hindi, and English.");
  await scanBuffer(buffer);
  const assetId = new mongoose.Types.ObjectId();
  const key = `private/media/${request.reader.id}/${assetId}/${randomUUID()}`;
  const fileName = safeFileName(request.get("x-file-name"), contentType);
  await storePrivateObject({ key, body: buffer, contentType });
  try {
    const asset = await MediaAsset.create({
      _id: assetId, key, fileName, contentType, size: buffer.length,
      scanStatus: "clean", altText, published: false, uploadedBy: request.reader._id,
    });
    response.setHeader("Cache-Control", "no-store");
    return response.status(201).json({ data: { asset: assetDto(asset) } });
  } catch (error) {
    await deletePrivateObject(key).catch(() => {});
    throw error;
  }
}

export async function updateAdminMedia(request, response) {
  if (!mongoose.isValidObjectId(request.params.assetId)) return errorResponse(response, 404, "MEDIA_NOT_FOUND", "Image not found.");
  const asset = await MediaAsset.findById(request.params.assetId);
  if (!asset) return errorResponse(response, 404, "MEDIA_NOT_FOUND", "Image not found.");
  const { published, altText } = request.body || {};
  if (published !== undefined && typeof published !== "boolean") return errorResponse(response, 400, "INVALID_MEDIA", "Choose a valid publication status.");
  if (altText !== undefined) {
    if (!altText || typeof altText !== "object" || Array.isArray(altText)
      || LANGUAGES.some((language) => typeof altText[language] !== "string" || altText[language].trim().length < 2 || altText[language].trim().length > 300)) {
      return errorResponse(response, 400, "MEDIA_ALT_REQUIRED", "Add image descriptions in Gujarati, Hindi, and English.");
    }
    asset.altText = Object.fromEntries(LANGUAGES.map((language) => [language, altText[language].trim()]));
  }
  if (published !== undefined) asset.published = published;
  await asset.save();
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { asset: assetDto(asset) } });
}

export async function deleteAdminMedia(request, response) {
  if (!mongoose.isValidObjectId(request.params.assetId)) return errorResponse(response, 404, "MEDIA_NOT_FOUND", "Image not found.");
  const asset = await MediaAsset.findById(request.params.assetId).select("+key");
  if (!asset) return errorResponse(response, 404, "MEDIA_NOT_FOUND", "Image not found.");
  await deletePrivateObject(asset.key);
  await asset.deleteOne();
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { deleted: true } });
}

export async function getPublishedMedia(request, response) {
  if (!mongoose.isValidObjectId(request.params.assetId)) return errorResponse(response, 404, "MEDIA_NOT_FOUND", "Image not found.");
  const asset = await MediaAsset.findOne({ _id: request.params.assetId, published: true }).select("+key").lean();
  if (!asset || asset.scanStatus !== "clean") return errorResponse(response, 404, "MEDIA_NOT_FOUND", "Image not found.");
  const object = await getPrivateObject(asset.key);
  response.setHeader("Cache-Control", "public, max-age=60");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Content-Type", asset.contentType);
  response.setHeader("Content-Length", String(asset.size));
  response.setHeader("Content-Disposition", `inline; filename="media-image"; filename*=UTF-8''${encodeURIComponent(asset.fileName)}`);
  object.Body.on("error", () => response.destroy());
  return object.Body.pipe(response);
}
