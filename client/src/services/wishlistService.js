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
    const error = new Error(result.error?.message || "Wishlist request failed.");
    error.status = response.status;
    error.code = result.error?.code || "REQUEST_FAILED";
    throw error;
  }
  return result.data;
}

export async function getReaderWishlist() {
  const result = await request("/api/v1/wishlist");
  return result.savedBookIds;
}

export function saveReaderWishlistBook(bookId) {
  return request("/api/v1/wishlist", {
    method: "POST",
    body: JSON.stringify({ bookId }),
  });
}

export function removeReaderWishlistBook(bookId) {
  return request(`/api/v1/wishlist/${encodeURIComponent(bookId)}`, { method: "DELETE" });
}
