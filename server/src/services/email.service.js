import { env } from "../config/env.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendEmail({ to, subject, html, text }) {
  if (!env.emailConfigured) {
    const error = new Error("Transactional email is not configured.");
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }

  let response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: env.emailFrom, to: [to], subject, html, text }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    const error = new Error("Transactional email could not be delivered.");
    error.code = "EMAIL_DELIVERY_FAILED";
    throw error;
  }

  if (!response.ok) {
    // Do not log provider bodies: they can include user data or operational details.
    const error = new Error("Transactional email provider rejected the message.");
    error.code = "EMAIL_DELIVERY_FAILED";
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export function sendVerificationEmail({ email, displayName, token }) {
  const url = new URL("/verify-email", env.appBaseUrl);
  url.searchParams.set("token", token);
  const name = escapeHtml(displayName);
  const link = escapeHtml(url.toString());
  return sendEmail({
    to: email,
    subject: "Verify your Rasbhav Books account",
    html: `<p>Hello ${name},</p><p>Please verify your email address to activate your Rasbhav Books account.</p><p><a href="${link}">Verify my email</a></p><p>This link expires in 30 minutes. If you did not create this account, ignore this email.</p>`,
    text: `Hello ${displayName},\n\nVerify your Rasbhav Books account: ${url}\n\nThis link expires in 30 minutes. If you did not create this account, ignore this email.`,
  });
}

export function sendPasswordResetEmail({ email, displayName, token }) {
  const url = new URL("/password-reset", env.appBaseUrl);
  url.searchParams.set("token", token);
  const name = escapeHtml(displayName);
  const link = escapeHtml(url.toString());
  return sendEmail({
    to: email,
    subject: "Reset your Rasbhav Books password",
    html: `<p>Hello ${name},</p><p>We received a request to reset your Rasbhav Books password.</p><p><a href="${link}">Choose a new password</a></p><p>This link expires in 30 minutes. If you did not request this, ignore this email.</p>`,
    text: `Hello ${displayName},\n\nReset your Rasbhav Books password: ${url}\n\nThis link expires in 30 minutes. If you did not request this, ignore this email.`,
  });
}
