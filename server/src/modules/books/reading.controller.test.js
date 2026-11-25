import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import test from "node:test";
import { createEbookReader } from "./reading.controller.js";

function response() {
  const res = new Writable({ write(chunk, encoding, callback) { callback(); } });
  res.headers = {};
  res.statusCode = 200;
  res.setHeader = function setHeader(key, value) { this.headers[key] = value; return this; };
  res.status = function status(code) { this.statusCode = code; return this; };
  res.json = function json(body) { this.body = body; return this; };
  res.destroy = function destroy(error) { this.wasDestroyed = true; return Writable.prototype.destroy.call(this, error); };
  return res;
}

test("streams only the approved PDF after reader access is confirmed", async () => {
  const body = Readable.from(["private pdf"]);
  const responseObject = response();
  const handler = createEbookReader({
    resolveAccess: async ({ readerId }) => readerId ? { sourceId: "507f1f77bcf86cd799439011" } : null,
    findApprovedManuscript: async () => ({ key: "private/key", scanStatus: "clean", contentType: "application/pdf", size: 11 }),
    getObject: async (key) => { assert.equal(key, "private/key"); return { Body: body }; },
  });
  await handler({ params: { bookId: "quiet-river" }, reader: { _id: "reader" } }, responseObject);
  assert.equal(responseObject.headers["Cache-Control"], "private, no-store");
  assert.equal(responseObject.headers["Content-Type"], "application/pdf");
  assert.equal(responseObject.headers["X-Content-Type-Options"], "nosniff");
  assert.equal(responseObject.headers["Content-Security-Policy"], "sandbox; frame-ancestors 'self'");
  await new Promise((resolve, reject) => responseObject.finished ? resolve() : responseObject.once("finish", resolve).once("error", reject));
});

test("returns the same not found response without access and never fetches the file", async () => {
  let fetched = false;
  const res = response();
  const handler = createEbookReader({ resolveAccess: async () => null, findApprovedManuscript: async () => null, getObject: async () => { fetched = true; } });
  await handler({ params: { bookId: "quiet-river" }, reader: { _id: "reader" } }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(fetched, false);
});


test("records reader-owned history only after a private book file is available", async () => {
  const calls = [];
  const body = Readable.from(["private pdf"]);
  const res = response();
  const handler = createEbookReader({
    resolveAccess: async () => ({ sourceId: "507f1f77bcf86cd799439011" }),
    findApprovedManuscript: async () => ({ key: "private/key", scanStatus: "clean", contentType: "application/pdf" }),
    getObject: async () => { calls.push("file"); return { Body: body }; },
    recordProgress: async (data) => { calls.push("history"); assert.deepEqual(data, { readerId: "reader-id", bookId: "quiet-river" }); },
  });
  await handler({ params: { bookId: "quiet-river" }, reader: { _id: "reader-id" } }, res);
  assert.deepEqual(calls, ["file", "history"]);
  await new Promise((resolve, reject) => res.finished ? resolve() : res.once("finish", resolve).once("error", reject));
});
