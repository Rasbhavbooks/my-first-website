async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || "Author follow request failed.");
    error.status = response.status;
    error.code = result.error?.code || "REQUEST_FAILED";
    throw error;
  }
  return result.data;
}

export async function getFollowedAuthors() {
  const result = await request("/api/v1/reader/follows");
  return result.authors;
}

export async function followAuthor(authorName) {
  return request("/api/v1/reader/follows", {
    method: "POST",
    body: JSON.stringify({ authorName }),
  });
}

export function unfollowAuthor(authorName) {
  return request(`/api/v1/reader/follows/${encodeURIComponent(authorName)}`, { method: "DELETE" });
}
