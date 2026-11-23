import mongoose from "mongoose";
import ReaderSession from "./reader-session.model.js";

const SESSION_COOKIE = "rasbhav_reader_session";

function clearSessionCookie(response) {
  response.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
}

export async function listReaderSessions(request, response) {
  response.setHeader("Cache-Control", "no-store");
  const now = new Date();
  const [total, sessions] = await Promise.all([
    ReaderSession.countDocuments({ userId: request.reader._id, expiresAt: { $gt: now } }),
    ReaderSession.find({ userId: request.reader._id, expiresAt: { $gt: now } })
      .sort({ createdAt: -1, _id: -1 })
      .limit(50)
      .select("createdAt expiresAt")
      .lean(),
  ]);

  const currentSessionId = String(request.readerSession._id);
  return response.json({
    data: {
      sessions: sessions.map((session) => ({
        id: String(session._id),
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        current: String(session._id) === currentSessionId,
      })),
      total,
      hasMore: total > sessions.length,
    },
  });
}

export async function revokeReaderSession(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!mongoose.isValidObjectId(request.params.sessionId)) {
    return response.status(404).json({ error: { code: "SESSION_NOT_FOUND", message: "Session was not found." } });
  }

  const session = await ReaderSession.findOneAndDelete({
    _id: request.params.sessionId,
    userId: request.reader._id,
    expiresAt: { $gt: new Date() },
  }).select("_id");

  if (!session) {
    return response.status(404).json({ error: { code: "SESSION_NOT_FOUND", message: "Session was not found." } });
  }

  const isCurrent = String(session._id) === String(request.readerSession._id);
  if (isCurrent) clearSessionCookie(response);
  return response.json({ data: { revoked: true, current: isCurrent } });
}
