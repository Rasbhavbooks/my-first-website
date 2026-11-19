async function authorRequest(path, payload, method = "GET") {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...(method === "GET" ? {} : { body: JSON.stringify(payload) }),
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

export const getMyAuthorApplication = () => authorRequest("/api/v1/author-applications/me");
export const submitAuthorApplication = (payload) => authorRequest("/api/v1/author-applications", payload, "POST");
export const getAuthorApplications = (status = "pending") => authorRequest(`/api/v1/admin/author-applications?status=${encodeURIComponent(status)}`);
export const decideAuthorApplication = (id, payload) => authorRequest(`/api/v1/admin/author-applications/${encodeURIComponent(id)}`, payload, "PATCH");
export const getMyAuthorProfile = () => authorRequest("/api/v1/author/profile");
export const updateMyAuthorProfile = (payload) => authorRequest("/api/v1/author/profile", payload, "PATCH");
export const getPublicAuthorProfile = (slug) => authorRequest(`/api/v1/authors/${encodeURIComponent(slug)}`);
