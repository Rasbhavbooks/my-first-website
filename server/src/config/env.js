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
};
