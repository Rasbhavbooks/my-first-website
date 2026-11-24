export async function getAdminOrders({ page = 1, limit = 25, status = "all" } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status !== "all") params.set("status", status);
  const response = await fetch("/api/v1/admin/orders?" + params.toString(), {
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result?.error?.message || "Could not load orders.");
    error.code = result?.error?.code || "REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return result.data;
}
