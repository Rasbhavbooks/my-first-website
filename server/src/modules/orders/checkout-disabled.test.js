import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import app from "../../app.js";

test("public reader checkout and order creation routes stay disabled", async (t) => {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  for (const path of [
    "/api/v1/orders",
    "/api/v1/reader/orders",
    "/api/v1/reader/checkout",
  ]) {
    const response = await fetch(baseUrl + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookId: "sample-book" }),
    });
    assert.equal(response.status, 404, `POST ${path} must stay unavailable`);
  }
});
