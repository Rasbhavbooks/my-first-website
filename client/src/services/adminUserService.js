async function adminUsersRequest(path = "", options = {}) {
  const response = await fetch(`/api/v1/admin/users${path}`, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || "User management could not be completed.");
    error.code = result.error?.code || "REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return result.data;
}

export function getAdminUsers(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return adminUsersRequest(`?${params.toString()}`);
}

export function setAdminUserStatus(userId, accountStatus) {
  return adminUsersRequest(`/${encodeURIComponent(userId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ accountStatus }),
  });
}
