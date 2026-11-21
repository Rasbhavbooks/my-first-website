import { defaultSiteContent } from "../../../shared/site-content.js";

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || "Site content could not be loaded or saved.");
    error.code = result.error?.code || "REQUEST_FAILED";
    throw error;
  }
  return result.data;
}

export async function getPublicSiteContent() {
  try {
    const result = await request("/api/v1/site-content", { credentials: "omit", cache: "no-store" });
    return result.settings || defaultSiteContent;
  } catch {
    return defaultSiteContent;
  }
}

export function getAdminSiteContent() {
  return request("/api/v1/admin/site-settings");
}

export function updateAdminSiteContent(settings) {
  return request("/api/v1/admin/site-settings", { method: "PATCH", body: JSON.stringify(settings) });
}
