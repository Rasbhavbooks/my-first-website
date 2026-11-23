async function adminDashboardRequest(path = "") {
  const response = await fetch(`/api/v1/admin/dashboard${path}`, { credentials: "include" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || "Admin dashboard could not be loaded.");
    error.code = result.error?.code || "REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return result.data;
}

export async function getAdminDashboardStats() {
  const result = await adminDashboardRequest();
  return result.stats;
}

export async function getAdminPlatformReadiness({ probeR2 = false } = {}) {
  const result = await adminDashboardRequest(`/readiness${probeR2 ? "?probeR2=true" : ""}`);
  return result.readiness;
}
