export async function getAdminSecuritySessions() {
  const response = await fetch("/api/v1/admin/security/sessions", {
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result?.error?.message || "Could not load administrator sessions.");
    error.code = result?.error?.code || "REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return result.data;
}
