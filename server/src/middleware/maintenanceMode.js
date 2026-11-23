import { isDatabaseConnected } from "../config/database.js";
import SiteSettings from "../modules/cms/site-settings.model.js";

const CACHE_MS = 5_000;
const ADMIN_AUTH_PATHS = new Set(["/auth/login", "/auth/session", "/auth/logout"]);
let cachedEnabled = false;
let cacheExpiresAt = 0;

export function invalidateMaintenanceModeCache() {
  cacheExpiresAt = 0;
}

export async function maintenanceMode(request, response, next) {
  const path = request.originalUrl.split("?")[0].replace(/^\/api\/v1/, "") || "/";
  if (path.startsWith("/admin/") || ADMIN_AUTH_PATHS.has(path)) return next();
  if (!isDatabaseConnected()) return next();

  if (Date.now() >= cacheExpiresAt) {
    try {
      const settings = await SiteSettings.findOne({ key: "global" }).select("maintenance.enabled -_id").lean();
      cachedEnabled = settings?.maintenance?.enabled === true;
      cacheExpiresAt = Date.now() + CACHE_MS;
    } catch {
      return next();
    }
  }

  if (!cachedEnabled) return next();
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Retry-After", "300");
  return response.status(503).json({
    error: { code: "MAINTENANCE_MODE", message: "This service is temporarily unavailable for maintenance." },
  });
}
