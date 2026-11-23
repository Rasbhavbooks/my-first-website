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
