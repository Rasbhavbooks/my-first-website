import { randomUUID } from "node:crypto";
import path from "node:path";
import mongoose from "mongoose";
import AuthorBook from "./author-book.model.js";
import { scanBuffer } from "../../services/clamav.service.js";
import { deletePrivateObject, getPrivateObject, storePrivateObject } from "../../services/r2-storage.service.js";

const MAX_MANUSCRIPT_BYTES = 25 * 1024 * 1024;
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const ASSET_TYPES = new Set(["cover", "manuscript"]);
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function errorResponse(response, status, code, message) {
  return response.status(status).json({ error: { code, message } });
}

function safeFileName(value, type, contentType) {
  const fallback = type === "cover" ? "cover" : "manuscript";
  let decodedName = value;
  try { decodedName = decodeURIComponent(value); } catch { /* Use the sanitized original header. */ }
  const base = (typeof decodedName === "string" ? decodedName.replaceAll("\\", "/").split("/").pop() : "")
    ?.replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^\p{L}\p{N} ._()-]/gu, "_")
    .trim()
    .slice(0, 140);
  const extension = path.extname(base || "").toLowerCase();
  const expected = {
    "application/pdf": ".pdf",
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": ".png",
    "image/webp": ".webp",
  }[contentType];
  const extensions = Array.isArray(expected) ? expected : [expected];
  return base && extensions.includes(extension) ? base : `${fallback}${extensions[0]}`;
}

function validSignature(buffer, contentType) {
  if (contentType === "application/pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (contentType === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (contentType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (contentType === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

function assetDto(asset) {
  if (!asset) return null;
  return {
    fileName: asset.fileName,
    contentType: asset.contentType,
    size: asset.size,
    scanStatus: asset.scanStatus,
    uploadedAt: asset.uploadedAt,
  };
}

function authorBookDto(book) {
  return {
    id: book.id,
    authorName: book.authorName,
    title: book.title,
    description: book.description,
    language: book.language,
    category: book.category,
    price: book.price,
    status: book.status,
    adminNote: book.adminNote,
    assets: { cover: assetDto(book.assets?.cover), manuscript: assetDto(book.assets?.manuscript) },
    submittedAt: book.submittedAt,
    reviewedAt: book.reviewedAt,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
  };
}

export async function uploadAuthorBookAsset(request, response) {
  const { bookId, assetType } = request.params;
  if (!mongoose.isValidObjectId(bookId) || !ASSET_TYPES.has(assetType)) {
    return errorResponse(response, 404, "AUTHOR_BOOK_NOT_FOUND", "Book draft not found.");
  }
  const book = await AuthorBook.findOne({
    _id: bookId,
    authorId: request.reader._id,
    status: { $in: ["draft", "rejected"] },
  }).select("+assets.cover.key +assets.manuscript.key");
  if (!book) return errorResponse(response, 404, "AUTHOR_BOOK_NOT_EDITABLE", "This draft was not found or can no longer be edited.");

  const buffer = request.body;
  const contentType = (request.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const maximum = assetType === "cover" ? MAX_COVER_BYTES : MAX_MANUSCRIPT_BYTES;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > maximum) {
    return errorResponse(response, 413, "INVALID_FILE_SIZE", "Choose a non-empty file within the size limit.");
  }
  if (!ALLOWED_TYPES.has(contentType)
    || (assetType === "cover" && !contentType.startsWith("image/"))
    || (assetType === "manuscript" && contentType !== "application/pdf")
    || !validSignature(buffer, contentType)) {
    return errorResponse(response, 400, "INVALID_FILE_TYPE", "Cover files must be JPEG, PNG, or WebP; manuscripts must be valid PDF files.");
  }

  await scanBuffer(buffer);
  const fileName = safeFileName(request.get("x-file-name"), assetType, contentType);
  const key = `private/books/${request.reader.id}/${book.id}/${assetType}-${randomUUID()}`;
  await storePrivateObject({ key, body: buffer, contentType });

  const existingKey = book.assets?.[assetType]?.key;
  const asset = { key, fileName, contentType, size: buffer.length, scanStatus: "clean", uploadedAt: new Date() };
  try {
    const updated = await AuthorBook.findOneAndUpdate(
      { _id: book._id, authorId: request.reader._id, status: { $in: ["draft", "rejected"] } },
      { $set: { [`assets.${assetType}`]: asset } },
      { new: true, runValidators: true },
    );
    if (!updated) {
      await deletePrivateObject(key);
      return errorResponse(response, 409, "AUTHOR_BOOK_NOT_EDITABLE", "This book was submitted while the file was uploading.");
    }
    if (existingKey && existingKey !== key) await deletePrivateObject(existingKey).catch(() => {});
    response.setHeader("Cache-Control", "no-store");
    return response.json({ data: { book: authorBookDto(updated) } });
  } catch (error) {
    await deletePrivateObject(key).catch(() => {});
    throw error;
  }
}

async function streamAsset(request, response, bookQuery) {
  const { bookId, assetType } = request.params;
  if (!mongoose.isValidObjectId(bookId) || !ASSET_TYPES.has(assetType)) {
    return errorResponse(response, 404, "AUTHOR_BOOK_NOT_FOUND", "Book file not found.");
  }
  const book = await AuthorBook.findOne({ _id: bookId, ...bookQuery }).select("+assets.cover.key +assets.manuscript.key");
  const asset = book?.assets?.[assetType];
  if (!asset?.key || asset.scanStatus !== "clean") return errorResponse(response, 404, "BOOK_ASSET_NOT_FOUND", "Book file not found.");
  const object = await getPrivateObject(asset.key);
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Content-Type", asset.contentType);
  response.setHeader("Content-Length", String(asset.size));
  response.setHeader("Content-Disposition", `attachment; filename="book-file"; filename*=UTF-8''${encodeURIComponent(asset.fileName)}`);
  object.Body.on("error", () => response.destroy());
  return object.Body.pipe(response);
}

export function getMyAuthorBookAsset(request, response) {
  return streamAsset(request, response, { authorId: request.reader._id });
}

export function getAdminAuthorBookAsset(request, response) {
  return streamAsset(request, response, { status: { $in: ["submitted", "approved"] } });
}
