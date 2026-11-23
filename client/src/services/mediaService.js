export async function getAdminMedia() {
  const response = await fetch("/api/v1/admin/media", { credentials: "include", cache: "no-store" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || "The media library could not be loaded.");
  return result.data?.assets || [];
}

export async function uploadAdminMedia(file, altText) {
  const response = await fetch("/api/v1/admin/media", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": file.type,
      "X-File-Name": encodeURIComponent(file.name),
      "X-Alt-En": altText.en,
      "X-Alt-Gu": altText.gu,
      "X-Alt-Hi": altText.hi,
    },
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
  if (!response.ok) throw new Error(result.error?.message || "The image could not be updated.");
  return result.data.asset;
}

export async function deleteAdminMedia(assetId) {
  const response = await fetch(`/api/v1/admin/media/${encodeURIComponent(assetId)}`, { method: "DELETE", credentials: "include" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || "The image could not be deleted.");
}
