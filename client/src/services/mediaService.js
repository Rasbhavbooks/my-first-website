export async function getAdminMedia() {
  const response = await fetch("/api/v1/admin/media", { credentials: "include", cache: "no-store" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || "The media library could not be loaded.");
  return result.data?.assets || [];
}

export async function uploadAdminMedia(file, altText) {
  const query = new URLSearchParams({ altEn: altText.en, altGu: altText.gu, altHi: altText.hi });
  const response = await fetch(`/api/v1/admin/media?${query}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": file.type, "X-File-Name": encodeURIComponent(file.name) },
    body: file,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || "The image could not be uploaded.");
    error.code = result.error?.code;
    throw error;
  }
  return result.data.asset;
}

export async function updateAdminMedia(assetId, payload) {
  const response = await fetch(`/api/v1/admin/media/${encodeURIComponent(assetId)}`, {
    method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(result.error?.message || "The image could not be updated."); error.code = result.error?.code; throw error; }
  return result.data.asset;
}

export async function deleteAdminMedia(assetId) {
  const response = await fetch(`/api/v1/admin/media/${encodeURIComponent(assetId)}`, { method: "DELETE", credentials: "include" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(result.error?.message || "The image could not be deleted."); error.code = result.error?.code; throw error; }
}
