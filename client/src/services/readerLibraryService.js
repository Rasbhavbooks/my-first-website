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


export async function clearReaderReadingHistory() {
  const response = await fetch("/api/v1/reader/library/recent", {
    method: "DELETE",
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || "Could not clear your reading history.");
    error.code = result.error?.code || "REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return result.data?.cleared === true;
}

async function readerBookmarkRequest(bookId, method = "GET", payload) {
  const response = await fetch("/api/v1/reader/library/" + encodeURIComponent(bookId) + "/bookmark", {
    method,
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json", ...(payload ? { "Content-Type": "application/json" } : {}) },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || "Could not update your bookmark.");
    error.code = result.error?.code || "REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return result.data;
}

export async function getReaderBookBookmark(bookId) {
  const result = await readerBookmarkRequest(bookId);
  return result.bookmark;
}

export async function saveReaderBookBookmark(bookId, { pageNumber, note = "" }) {
  const result = await readerBookmarkRequest(bookId, "PUT", { pageNumber, note });
  return result.bookmark;
}

export async function deleteReaderBookBookmark(bookId) {
  const result = await readerBookmarkRequest(bookId, "DELETE");
  return result.removed === true;
}
export function getReadingChallenge() {
  return readLibraryResponse("/api/v1/reader/library/challenge");
}

export async function getReadingCompletion(bookId) {
  return readLibraryResponse("/api/v1/reader/library/" + encodeURIComponent(bookId) + "/completion");
}

export async function setReadingCompletion(bookId, completed) {
  const response = await fetch("/api/v1/reader/library/" + encodeURIComponent(bookId) + "/completion", {
    method: completed ? "PUT" : "DELETE",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Could not save your reading progress.");
  return (await response.json()).data;
}

export function getReaderRecommendations() {
  return readLibraryResponse("/api/v1/reader/library/recommendations");
}
