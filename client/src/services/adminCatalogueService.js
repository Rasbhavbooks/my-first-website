async function catalogueRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || "Catalogue management could not be completed.");
    error.code = result.error?.code || "REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return result.data;
}

export function getAdminCatalogueBooks(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  return catalogueRequest(`/api/v1/admin/catalogue-books?${params.toString()}`);
}

export function updateAdminCatalogueBook(bookId, payload) {
  return catalogueRequest(`/api/v1/admin/catalogue-books/${encodeURIComponent(bookId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
