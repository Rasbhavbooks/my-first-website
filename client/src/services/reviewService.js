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
    const error = new Error(result.error?.message || "Review request failed.");
    error.status = response.status;
    error.code = result.error?.code || "REQUEST_FAILED";
    throw error;
  }
  return result.data;
}

export function getBookReviews(bookId, page = 1) {
  return request(`/api/v1/books/${encodeURIComponent(bookId)}/reviews?page=${page}`);
}

export function getMyBookReview(bookId) {
  return request(`/api/v1/books/${encodeURIComponent(bookId)}/reviews/mine`);
}

export function createBookReview(bookId, payload) {
  return request(`/api/v1/books/${encodeURIComponent(bookId)}/reviews`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateBookReview(bookId, reviewId, payload) {
  return request(`/api/v1/books/${encodeURIComponent(bookId)}/reviews/${encodeURIComponent(reviewId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteBookReview(bookId, reviewId) {
  return request(`/api/v1/books/${encodeURIComponent(bookId)}/reviews/${encodeURIComponent(reviewId)}`, {
    method: "DELETE",
  });
}

export function reportBookReview(bookId, reviewId, payload) {
  return request(`/api/v1/books/${encodeURIComponent(bookId)}/reviews/${encodeURIComponent(reviewId)}/report`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
