async function bookRequest(path, payload, method = "GET") {
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

export const getMyAuthorBooks = () => bookRequest("/api/v1/author/books");
export const createAuthorBookDraft = () => bookRequest("/api/v1/author/books", {}, "POST");
export const saveAuthorBookDraft = (id, payload) => bookRequest(`/api/v1/author/books/${encodeURIComponent(id)}`, payload, "PATCH");
export const submitAuthorBook = (id) => bookRequest(`/api/v1/author/books/${encodeURIComponent(id)}/submit`, {}, "POST");
