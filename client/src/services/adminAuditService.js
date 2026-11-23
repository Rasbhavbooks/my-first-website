export async function getAdminAuditEvents({ page = 1, limit = 25 } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const response = await fetch("/api/v1/admin/audit-logs?" + params.toString(), {
    credentials: "include",
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message || "Could not load administrator activity.");
  return result.data;
}
