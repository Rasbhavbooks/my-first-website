import { randomUUID } from "node:crypto";
import User from "../users/user.model.js";
import { deletePrivateObject, getPrivateObject, storePrivateObject } from "../../services/r2-storage.service.js";
import { scanBuffer } from "../../services/clamav.service.js";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function sendError(response, status, code, message) {
  return response.status(status).json({ error: { code, message } });
}

function hasValidSignature(buffer, contentType) {
  if (contentType === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (contentType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (contentType === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

export async function uploadReaderAvatar(request, response) {
  const buffer = request.body;
  const contentType = (request.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_AVATAR_BYTES) {
    return sendError(response, 413, "INVALID_AVATAR_SIZE", "Choose a non-empty image up to 5 MB.");
  }
  if (!IMAGE_TYPES.has(contentType) || !hasValidSignature(buffer, contentType)) {
    return sendError(response, 400, "INVALID_AVATAR_TYPE", "Choose a valid JPEG, PNG, or WebP image.");
  }

  await scanBuffer(buffer);
  const key = `private/readers/${request.reader.id}/avatar-${randomUUID()}`;
  await storePrivateObject({ key, body: buffer, contentType });
  let previousUser;
  try {
    previousUser = await User.findOneAndUpdate(
      { _id: request.reader._id },
      { $set: {
        avatarAssetKey: key,
        avatarAssetContentType: contentType,
        avatarAssetSize: buffer.length,
        avatarUploadedAt: new Date(),
      } },
      { new: false, runValidators: true },
    ).select("+avatarAssetKey");
  } catch (error) {
    await deletePrivateObject(key).catch(() => {});
    throw error;
  }
  if (!previousUser) {
    await deletePrivateObject(key).catch(() => {});
    return sendError(response, 404, "ACCOUNT_NOT_FOUND", "This account is no longer available.");
  }
  if (previousUser.avatarAssetKey && previousUser.avatarAssetKey !== key) {
    await deletePrivateObject(previousUser.avatarAssetKey).catch(() => {});
  }

  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { avatarPhotoUrl: "/api/v1/auth/profile/photo" } });
}

export async function getReaderAvatar(request, response) {
  const user = request.reader;
  if (!user.avatarAssetKey || !user.avatarAssetContentType || !user.avatarAssetSize) {
    return sendError(response, 404, "AVATAR_NOT_FOUND", "Profile photo was not found.");
  }
  const object = await getPrivateObject(user.avatarAssetKey);
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Content-Type", user.avatarAssetContentType);
  response.setHeader("Content-Length", String(user.avatarAssetSize));
  response.setHeader("Content-Disposition", 'inline; filename="reader-profile-photo"');
  object.Body.on("error", () => response.destroy());
  return object.Body.pipe(response);
}

export async function deleteReaderAvatar(request, response) {
  const user = await User.findOneAndUpdate(
    { _id: request.reader._id },
    { $unset: {
      avatarAssetKey: 1,
      avatarAssetContentType: 1,
      avatarAssetSize: 1,
      avatarUploadedAt: 1,
    } },
    { new: false },
  ).select("+avatarAssetKey");
  if (user?.avatarAssetKey) await deletePrivateObject(user.avatarAssetKey).catch(() => {});
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { avatarPhotoUrl: "" } });
}
