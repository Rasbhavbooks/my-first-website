import { createHash } from "node:crypto";
import ReaderSession from "./reader-session.model.js";

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
  }).populate("userId");

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
