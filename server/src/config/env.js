const port = Number(process.env.PORT || 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535.");

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
  r2AccountId: process.env.R2_ACCOUNT_ID || "",
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID || "",
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  r2BucketName: process.env.R2_BUCKET_NAME || "",
  r2Configured: Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME),
  clamavHost: process.env.CLAMAV_HOST || "",
  clamavPort: Number(process.env.CLAMAV_PORT || 3310),
  clamavConfigured: Boolean(process.env.CLAMAV_HOST),
};
