import assert from "node:assert/strict";
import test from "node:test";
import LoginSecurityMetric from "../auth/login-security-metric.model.js";
import { getAdminLoginSecurityMetrics } from "./admin-login-security.controller.js";

function responseMock() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    json(body) { this.body = body; return this; },
  };
}

test("admin metrics returns only hourly aggregates and private no-store data", async t => {
  const rows = [
    { bucketStart: new Date("2026-11-25T06:00:00.000Z"), loginSuccesses: 4, loginFailures: 3, knownAccountFailures: 2 },
    { bucketStart: new Date("2026-11-25T07:00:00.000Z"), loginSuccesses: 2, loginFailures: 1, knownAccountFailures: 1 },
  ];
  let filter;
  const query = {
    sort(value) { assert.deepEqual(value, { bucketStart: 1 }); return this; },
    lean: async () => rows,
  };
  t.mock.method(LoginSecurityMetric, "find", value => { filter = value; return query; });
  const response = responseMock();

  await getAdminLoginSecurityMetrics({}, response);

  assert.equal(response.headers["Cache-Control"], "no-store");
  assert.equal(filter.bucketStart.$gte instanceof Date, true);
  assert.equal(filter.bucketStart.$lte instanceof Date, true);
  assert.deepEqual(response.body.data.totals, {
    loginSuccesses: 6,
    loginFailures: 4,
    knownAccountFailures: 3,
  });
  assert.deepEqual(response.body.data.buckets.map(row => row.hour), [
    "2026-11-25T06:00:00.000Z",
    "2026-11-25T07:00:00.000Z",
  ]);
  assert.equal(JSON.stringify(response.body).includes("email"), false);
  assert.equal(JSON.stringify(response.body).includes("ipAddress"), false);
});
