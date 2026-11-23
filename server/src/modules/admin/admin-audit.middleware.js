import AdminAuditEvent from "./admin-audit.model.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const OBJECT_ID_SEGMENT = /^[a-f0-9]{24}$/i;
const UUID_SEGMENT = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const NUMERIC_ID_SEGMENT = /^\d{6,}$/;

function sanitizePath(originalUrl) {
  const rawPath = String(originalUrl || "/").split("?")[0];
  return rawPath.split("/").map((segment) => {
    let decoded = segment;
    try { decoded = decodeURIComponent(segment); } catch { /* Keep the raw path segment. */ }
    if (OBJECT_ID_SEGMENT.test(decoded) || UUID_SEGMENT.test(decoded) || NUMERIC_ID_SEGMENT.test(decoded) || decoded.includes("@")) {
      return ":id";
    }
    return decoded.replace(/[\\\u0000-\u001f\u007f]/g, "_").slice(0, 64);
  }).join("/").slice(0, 240);
}

export function recordAdminActivity(request, response, next) {
  if (!MUTATING_METHODS.has(request.method)) return next();
  const adminBasePath = request.baseUrl || "/api/v1/admin";

  response.once("finish", () => {
    const actorId = request.reader?._id;
    if (response.statusCode < 200 || response.statusCode >= 300
      || request.reader?.role !== "admin" || !request.reader?.adminMfaEnabled || !actorId) return;

    void AdminAuditEvent.create({
      actorId,
      method: request.method,
      path: sanitizePath(request.route?.path
        ? `${adminBasePath}${Array.isArray(request.route.path) ? request.route.path[0] : request.route.path}`
        : request.originalUrl),
      statusCode: response.statusCode,
    }).catch((error) => {
      console.error("Could not record an administrator activity event.", error);
    });
  });

  return next();
}
