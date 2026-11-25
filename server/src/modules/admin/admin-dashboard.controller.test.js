import assert from "node:assert/strict";
import test from "node:test";
import { buildPlatformReadiness } from "./admin-dashboard.controller.js";

test("reports Razorpay readiness as booleans without exposing any credential values", () => {
  const readiness = buildPlatformReadiness({
    environment: {
      emailConfigured: true,
      adminMfaConfigured: false,
      r2Configured: true,
      clamavConfigured: true,
      razorpayConfigured: true,
      razorpayWebhookConfigured: false,
      razorpayMode: "test",
      razorpayKeyId: "rzp_test_never-return-this",
      razorpayKeySecret: "never-return-this-secret",
      razorpayWebhookSecret: "never-return-this-webhook-secret",
    },
    databaseConnected: true,
    r2BucketReachable: null,
    clamavReachable: false,
  });

  assert.equal(readiness.razorpayConfigured, true);
  assert.equal(readiness.razorpayWebhookConfigured, false);
  assert.equal(readiness.razorpayCredentialsReachable, null);
  assert.equal(readiness.razorpayMode, "test");
  assert.equal(readiness.checkoutEnabled, false);
  assert.equal(readiness.publishingEnabled, false);
  assert.equal(JSON.stringify(readiness).includes("never-return-this"), false);
  assert.equal(JSON.stringify(readiness).includes("rzp_test_"), false);
});
