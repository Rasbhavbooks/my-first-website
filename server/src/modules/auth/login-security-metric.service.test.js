import assert from "node:assert/strict";
import test from "node:test";
import { recordLoginSecurityMetric } from "./login-security-metric.service.js";

test("records only hourly aggregate counters without account identifiers", async () => {
  let operation;
  const model = {
    async updateOne(...args) { operation = args; },
  };
  const now = new Date("2026-11-25T07:42:00.000Z");
  assert.equal(await recordLoginSecurityMetric({ outcome: "failure", knownAccount: true, now, model }), true);
  assert.deepEqual(operation, [
    { bucketStart: new Date("2026-11-25T07:00:00.000Z") },
    {
      $inc: { loginFailures: 1, knownAccountFailures: 1 },
      $setOnInsert: {
        bucketStart: new Date("2026-11-25T07:00:00.000Z"),
        expiresAt: new Date("2027-02-23T07:00:00.000Z"),
      },
    },
    { upsert: true, runValidators: true },
  ]);
  assert.equal(JSON.stringify(operation).includes("email"), false);
  assert.equal(JSON.stringify(operation).includes("ip"), false);
});

test("records successful sign-ins and does not throw if monitoring storage fails", async () => {
  let update;
  const model = { async updateOne(_filter, change) { update = change; } };
  assert.equal(await recordLoginSecurityMetric({
    outcome: "success", now: new Date("2026-11-25T07:05:00.000Z"), model,
  }), true);
  assert.deepEqual(update.$inc, { loginSuccesses: 1 });

  assert.equal(await recordLoginSecurityMetric({
    outcome: "failure",
    now: new Date("2026-11-25T07:05:00.000Z"),
    model: { async updateOne() { throw new Error("offline"); } },
  }), false);
  assert.equal(await recordLoginSecurityMetric({ outcome: "unexpected" }), false);
});
