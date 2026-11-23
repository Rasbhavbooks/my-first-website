import { createHash } from "node:crypto";
import ReaderSession from "./reader-session.model.js";
import AuthorProfile from "./author-profile.model.js";
import AdminMfa from "./admin-mfa.model.js";

const SESSION_COOKIE = "rasbhav_reader_session";

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function readSessionCookie(request) {
  const cookies = request.headers.cookie || "";
  const entry = cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return entry ? entry.slice(SESSION_COOKIE.length + 1) : "";
}

export async function requireReader(request, response, next) {
  const token = readSessionCookie(request);
  if (!token) {
    return response.status(401).json({
      error: { code: "NOT_AUTHENTICATED", message: "Sign in to continue." },
    });
  }

  const session = await ReaderSession.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  }).populate({ path: "userId", select: "+avatarAssetKey +avatarAssetContentType +avatarAssetSize" });

  if (!session || !session.userId || session.userId.accountStatus !== "active") {
    if (session) await ReaderSession.deleteOne({ _id: session._id });
    response.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });
    return response.status(401).json({
      error: { code: "NOT_AUTHENTICATED", message: "Sign in to continue." },
    });
  }

  request.reader = session.userId;
  request.readerSession = session;
  return next();
}


export function requireAdminIdentity(request, response, next) {
  if (request.reader?.role !== "admin") {
    return response.status(403).json({
      error: { code: "ADMIN_ACCESS_REQUIRED", message: "Administrator access is required." },
    });
  }
  return next();
}

export async function requireAdmin(request, response, next) {
  if (request.reader?.role !== "admin") {
    return response.status(403).json({
      error: { code: "ADMIN_ACCESS_REQUIRED", message: "Administrator access is required." },
    });
  }
  if (!request.reader.adminMfaEnabled || !await AdminMfa.exists({ userId: request.reader._id, enabled: true })) {
    return response.status(403).json({
      error: { code: "ADMIN_MFA_REQUIRED", message: "Set up administrator multi-factor authentication to continue." },
    });
  }
  return next();
}


export async function requireAuthor(request, response, next) {
  if (request.reader?.role !== "author") {
    return response.status(403).json({
      error: { code: "AUTHOR_ACCESS_REQUIRED", message: "An approved author account is required." },
    });
  }
  const profile = await AuthorProfile.exists({ userId: request.reader._id, status: "active" });
  if (!profile) {
    return response.status(403).json({
      error: { code: "AUTHOR_PROFILE_SUSPENDED", message: "This author profile is not active." },
    });
  }
  return next();
}
