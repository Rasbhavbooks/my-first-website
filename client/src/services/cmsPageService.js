async function cmsRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || "The page request could not be completed.");
    error.code = result.error?.code || "REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return result.data;
}

export async function getPublishedCmsPages() {
  try {
    const response = await fetch("/api/v1/pages", { cache: "no-store" });
    if (!response.ok) return [];
    const result = await response.json().catch(() => ({}));
    return result.data?.pages || [];
  } catch {
    return [];
  }
}

export async function getPublishedCmsPage(slug) {
  const result = await cmsRequest(`/api/v1/pages/${encodeURIComponent(slug)}`, { credentials: "omit" });
  return result.page;
}

export function getAdminCmsPages() {
  return cmsRequest("/api/v1/admin/cms-pages");
}

export function createCmsPage(payload) {
  return cmsRequest("/api/v1/admin/cms-pages", { method: "POST", body: JSON.stringify(payload) });
}

export function updateCmsPage(slug, payload) {
  return cmsRequest(`/api/v1/admin/cms-pages/${encodeURIComponent(slug)}`, { method: "PATCH", body: JSON.stringify(payload) });
}
