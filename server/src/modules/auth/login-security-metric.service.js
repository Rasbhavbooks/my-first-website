import LoginSecurityMetric from "./login-security-metric.model.js";

const HOUR_MS = 60 * 60 * 1000;
const RETENTION_MS = 90 * 24 * HOUR_MS;

export async function recordLoginSecurityMetric({
  outcome,
  knownAccount = false,
  now = new Date(),
  model = LoginSecurityMetric,
}) {
  if (!["success", "failure"].includes(outcome) || !(now instanceof Date) || Number.isNaN(now.getTime())) {
    return false;
  }
  const hour = new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS);
  const increments = outcome === "success"
    ? { loginSuccesses: 1 }
    : { loginFailures: 1, ...(knownAccount ? { knownAccountFailures: 1 } : {}) };
  try {
    await model.updateOne(
      { bucketStart: hour },
      {
        $inc: increments,
        $setOnInsert: { bucketStart: hour, expiresAt: new Date(hour.getTime() + RETENTION_MS) },
      },
      { upsert: true, runValidators: true },
    );
    return true;
  } catch {
    // Monitoring must not change the authentication response if its write is temporarily unavailable.
    return false;
  }
}
