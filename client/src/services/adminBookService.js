async function adminBookRequest(path, payload, method = "GET") {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...(method === "GET" ? {} : { body: JSON.stringify(payload ?? {}) }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || "The request could not be completed.");
    error.code = result.error?.code || "REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return result.data;
}

export const getSubmittedAuthorBooks = () => adminBookRequest("/api/v1/admin/author-books");
export const decideAuthorBook = (id, payload) => adminBookRequest(`/api/v1/admin/author-books/${encodeURIComponent(id)}`, payload, "PATCH");
