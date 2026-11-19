async function postAuthRequest(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(result.error?.message || "The request could not be completed.");
    error.code = result.error?.code || "REQUEST_FAILED";
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
