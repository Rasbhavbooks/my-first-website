async function adminRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "include",
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

export function getReviewReports(status = "pending") {
  return adminRequest(`/api/v1/admin/reviews/reports?status=${encodeURIComponent(status)}`);
}

export function updateReviewModeration(reviewId, payload) {
  return adminRequest(`/api/v1/admin/reviews/reviews/${encodeURIComponent(reviewId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function resolveReviewReport(reportId, payload) {
  return adminRequest(`/api/v1/admin/reviews/reports/${encodeURIComponent(reportId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
