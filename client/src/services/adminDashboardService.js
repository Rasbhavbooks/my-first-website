async function adminDashboardRequest() {
  const response = await fetch("/api/v1/admin/dashboard", { credentials: "include" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || "Admin dashboard could not be loaded.");
    error.code = result.error?.code || "REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return result.data.stats;
}

export function getAdminDashboardStats() {
  return adminDashboardRequest();
}
