async function readLibraryResponse(url) {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || "Could not load your library.");
    error.code = result.error?.code || "REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return result.data;
}

export function getReaderLibrary({ freeCursor = "", purchasedCursor = "" } = {}) {
  const query = new URLSearchParams();
  if (freeCursor) query.set("freeCursor", freeCursor);
  if (purchasedCursor) query.set("purchasedCursor", purchasedCursor);
  const suffix = query.size ? `?${query.toString()}` : "";
  return readLibraryResponse(`/api/v1/reader/library${suffix}`);
}

export async function getReaderLibraryBook(bookId) {
  const result = await readLibraryResponse(`/api/v1/reader/library/${encodeURIComponent(bookId)}`);
  return result.book;
}


export async function getRecentlyOpenedBooks() {
  const result = await readLibraryResponse("/api/v1/reader/library/recent");
  return result.books || [];
}
