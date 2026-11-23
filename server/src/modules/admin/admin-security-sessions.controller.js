import ReaderSession from "../auth/reader-session.model.js";
import User from "../users/user.model.js";

export async function listAdminSecuritySessions(_request, response) {
  response.setHeader("Cache-Control", "no-store");
  const now = new Date();
  const admins = await User.find({ role: "admin", accountStatus: "active" })
    .select("_id displayName")
    .lean();
  if (!admins.length) return response.json({ data: { sessions: [], total: 0, hasMore: false } });

  const adminById = new Map(admins.map((admin) => [String(admin._id), admin]));
  const [total, sessions] = await Promise.all([
    ReaderSession.countDocuments({ userId: { $in: admins.map((admin) => admin._id) }, expiresAt: { $gt: now } }),
    ReaderSession.find({ userId: { $in: admins.map((admin) => admin._id) }, expiresAt: { $gt: now } })
      .sort({ createdAt: -1, _id: -1 })
      .limit(50)
      .select("userId createdAt expiresAt")
      .lean(),
  ]);

  const currentSessionId = String(response.locals.readerSessionId || "");
  return response.json({
    data: {
      sessions: sessions.map((session) => {
        const admin = adminById.get(String(session.userId));
        return {
          id: String(session._id),
          actorId: String(session.userId),
          displayName: admin?.displayName || "",
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          current: String(session._id) === currentSessionId,
        };
      }),
      total,
      hasMore: total > sessions.length,
    },
  });
}
