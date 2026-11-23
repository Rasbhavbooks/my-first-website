async function blogRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || "The blog request could not be completed.");
    error.code = result.error?.code || "REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return result.data;
}

export async function getPublishedBlogPosts() {
  const result = await blogRequest("/api/v1/blog", { credentials: "omit" });
  return result.posts || [];
}

export async function getPublishedBlogPost(slug) {
  const result = await blogRequest(`/api/v1/blog/${encodeURIComponent(slug)}`, { credentials: "omit" });
  return result.post;
}

export function getAdminBlogPosts() {
  return blogRequest("/api/v1/admin/blog-posts");
}

export function createBlogPost(payload) {
  return blogRequest("/api/v1/admin/blog-posts", { method: "POST", body: JSON.stringify(payload) });
}

export function updateBlogPost(slug, payload) {
  return blogRequest(`/api/v1/admin/blog-posts/${encodeURIComponent(slug)}`, { method: "PATCH", body: JSON.stringify(payload) });
}
