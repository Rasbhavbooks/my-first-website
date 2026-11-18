import assert from "node:assert/strict";
import test from "node:test";
import { getHealth } from "./health.controller.js";

test("health endpoint reports API availability and database state", () => {
  const response = {
    statusCode: 0,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  getHealth({}, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, "ok");
  assert.equal(response.body.service, "rasbhav-books-api");
  assert.equal(response.body.database, "not_connected");
  assert.equal(Number.isNaN(Date.parse(response.body.timestamp)), false);
});
