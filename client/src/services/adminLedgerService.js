export async function getAdminLedgerTransactions({ page = 1, limit = 25 } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const response = await fetch("/api/v1/admin/ledger?" + params.toString(), {
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result?.error?.message || "Could not load the financial ledger.");
    error.code = result?.error?.code || "REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return result.data;
}
