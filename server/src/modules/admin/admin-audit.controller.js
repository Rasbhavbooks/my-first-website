import { isDatabaseConnected } from "../../config/database.js";
import AdminAuditEvent from "./admin-audit.model.js";

function databaseUnavailable(response) {
  return response.status(503).json({
    error: { code: "DATABASE_UNAVAILABLE", message: "Administrator activity history is temporarily unavailable." },
  });
}

function parsePositiveInteger(value, fallback, maximum) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : null;
}

export async function listAdminAuditEvents(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!isDatabaseConnected()) return databaseUnavailable(response);
  const page = parsePositiveInteger(request.query.page, 1, 100000);
  const limit = parsePositiveInteger(request.query.limit, 25, 100);
  if (!page || !limit) {
    return response.status(400).json({ error: { code: "INVALID_PAGINATION", message: "Choose a valid audit history page." } });
  }

  const [total, events] = await Promise.all([
    AdminAuditEvent.countDocuments(),
    AdminAuditEvent.find().sort({ occurredAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit)
      .select("actorId method path statusCode occurredAt -_id").lean(),
  ]);
  return response.json({
    data: {
      events: events.map((event) => ({
        actorId: String(event.actorId),
        method: event.method,
        path: event.path,
        statusCode: event.statusCode,
        occurredAt: event.occurredAt,
      })),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}
