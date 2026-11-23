async function postAuthRequest(path, payload, method = "POST") {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...(method === "GET" ? {} : { body: JSON.stringify(payload) }),
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

export function registerReader(payload) {
  return postAuthRequest("/api/v1/auth/register", payload);
}

export function verifyReaderEmail(token) {
  return postAuthRequest("/api/v1/auth/verify-email", { token });
}

export function loginReader(payload) {
  return postAuthRequest("/api/v1/auth/login", payload);
}

export async function getReaderSession() {
  try {
    return await postAuthRequest("/api/v1/auth/session", undefined, "GET");
  } catch (error) {
    if (error.status === 401) return null;
    throw error;
  }
}

export function logoutReader() {
  return postAuthRequest("/api/v1/auth/logout", {});
}

export function getReaderProfile() {
  return postAuthRequest("/api/v1/auth/profile", undefined, "GET");
}

export function updateReaderProfile(payload) {
  return postAuthRequest("/api/v1/auth/profile", payload, "PATCH");
}

export function changeReaderPassword(payload) {
  return postAuthRequest("/api/v1/auth/change-password", payload);
}


export function requestReaderPasswordReset(email) {
  return postAuthRequest("/api/v1/auth/password-reset/request", { email });
}

export function resetReaderPassword(payload) {
  return postAuthRequest("/api/v1/auth/password-reset/confirm", payload);
}


export function resendReaderVerification(email) {
  return postAuthRequest("/api/v1/auth/resend-verification", { email });
}

export function getAdminMfaStatus() {
  return postAuthRequest("/api/v1/admin/mfa/status", undefined, "GET");
}

export function startAdminMfaSetup(password) {
  return postAuthRequest("/api/v1/admin/mfa/setup", { password });
}

export function confirmAdminMfaSetup(code) {
  return postAuthRequest("/api/v1/admin/mfa/confirm", { code });
}
export async function downloadReaderAccountData() {
  const response = await fetch("/api/v1/auth/profile/export", {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    const error = new Error(result.error?.message || "Account data export failed.");
    error.code = result.error?.code || "REQUEST_FAILED";
    throw error;
  }
  return response.blob();
}


export async function getReaderSessions() {
  const response = await fetch("/api/v1/auth/sessions", {
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result?.error?.message || "Could not load active sessions.");
    error.code = result?.error?.code || "REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return result.data;
}

export async function revokeReaderSession(sessionId) {
  const response = await fetch(`/api/v1/auth/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result?.error?.message || "Could not sign out this session.");
    error.code = result?.error?.code || "REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return result.data;
}
