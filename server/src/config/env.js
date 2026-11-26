const port = Number(process.env.PORT || 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535.");

const clamavPort = Number(process.env.CLAMAV_PORT || 3310);
if (!Number.isInteger(clamavPort) || clamavPort < 1 || clamavPort > 65535) {
  throw new Error("CLAMAV_PORT must be between 1 and 65535.");
}
const r2AccountId = process.env.R2_ACCOUNT_ID || "";
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || "";
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "";
const r2BucketName = process.env.R2_BUCKET_NAME || "";
const adminMfaEncryptionKey = process.env.ADMIN_MFA_ENCRYPTION_KEY || "";
const razorpayMode = process.env.RAZORPAY_MODE || "test";
const razorpayKeyId = process.env.RAZORPAY_KEY_ID || "";
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || "";
const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
function readTestRate(name, fallback, maximum) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  if (!/^\\d+$/.test(raw)) throw new Error(`${name} must be a whole-number basis-point rate.`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new Error(`${name} must be between 0 and ${maximum} basis points.`);
  }
  return value;
}
const testGstRateBps = readTestRate("TEST_GST_RATE_BPS", 500, 10000);
const testGatewayRateBps = readTestRate("TEST_GATEWAY_RATE_BPS", 200, 5000);
if (razorpayMode !== "test") throw new Error("RAZORPAY_MODE must remain test until launch approval.");
if (razorpayKeyId && !razorpayKeyId.startsWith("rzp_test_")) {
  throw new Error("RAZORPAY_KEY_ID must be a Razorpay test-mode key while RAZORPAY_MODE is test.");
}
if (adminMfaEncryptionKey && !/^[A-Fa-f0-9]{64}$/.test(adminMfaEncryptionKey)) {
  throw new Error("ADMIN_MFA_ENCRYPTION_KEY must be exactly 64 hexadecimal characters.");
}
if (r2AccountId && !/^[A-Za-z0-9-]+$/.test(r2AccountId)) {
  throw new Error("R2_ACCOUNT_ID contains unsupported characters.");
}
if (r2BucketName && !/^[a-z0-9-]+$/.test(r2BucketName)) {
  throw new Error("R2_BUCKET_NAME contains unsupported characters.");
}

const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const configuredAppBaseUrl = process.env.APP_BASE_URL || "";
const appBaseUrl = configuredAppBaseUrl || clientOrigin;
try {
  const parsedAppUrl = new URL(appBaseUrl);
  if (!["http:", "https:"].includes(parsedAppUrl.protocol) || parsedAppUrl.username || parsedAppUrl.password) {
    throw new Error();
  }
} catch {
  throw new Error("APP_BASE_URL must be a valid HTTP or HTTPS URL.");
}

const resendApiKey = process.env.RESEND_API_KEY || "";
const emailFrom = process.env.EMAIL_FROM || "";

export const env = {
  port,
  clientOrigin,
  appBaseUrl: new URL(appBaseUrl).origin,
  mongoUri: process.env.MONGODB_URI || "",
  resendApiKey,
  emailFrom,
  emailConfigured: Boolean(resendApiKey && emailFrom && configuredAppBaseUrl),
  r2AccountId,
  r2AccessKeyId,
  r2SecretAccessKey,
  r2BucketName,
  r2Configured: Boolean(r2AccountId && r2AccessKeyId && r2SecretAccessKey && r2BucketName),
  clamavHost: process.env.CLAMAV_HOST || "",
  clamavPort,
  clamavConfigured: Boolean(process.env.CLAMAV_HOST),
  adminMfaEncryptionKey,
  adminMfaConfigured: Boolean(adminMfaEncryptionKey),
  testGstRateBps,\n  testGatewayRateBps,\n  razorpayMode,
  razorpayKeyId,
  razorpayKeySecret,
  razorpayWebhookSecret,
  razorpayConfigured: Boolean(razorpayKeyId && razorpayKeySecret),
  razorpayWebhookConfigured: Boolean(razorpayWebhookSecret),
};
