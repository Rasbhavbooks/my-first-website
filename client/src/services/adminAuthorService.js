async function adminAuthorRequest(path = "", options = {}) {
  const response = await fetch(`/api/v1/admin/authors${path}`, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || "Author management could not be completed.");
    error.code = result.error?.code || "REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return result.data;
}

export function getAdminAuthors(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  return adminAuthorRequest(`?${params.toString()}`);
}

export function setAdminAuthorStatus(authorId, status) {
  return adminAuthorRequest(`/${encodeURIComponent(authorId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
