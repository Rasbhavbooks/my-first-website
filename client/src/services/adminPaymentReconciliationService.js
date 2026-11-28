export async function getAdminPaymentReconciliation({ page = 1, limit = 25, failedOnly = false } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (failedOnly) params.set("outcome", "failed");
  const response = await fetch("/api/v1/admin/payment-reconciliation?" + params.toString(), {
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result?.error?.message || "Could not load payment reconciliation.");
    error.code = result?.error?.code || "REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return result.data;
}
