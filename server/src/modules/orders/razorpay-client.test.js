import assert from "node:assert/strict";
import test from "node:test";
import { createRazorpayClient } from "./razorpay-client.js";

const expected = { amountPaise: 1250, currency: "INR", receipt: "rb-attempt123", notes: { order_id: "abc" } };
const providerOrder = { id: "order_test123", amount: 1250, currency: "INR", receipt: expected.receipt };

test("creates a sandbox Razorpay order with the server's amount and receipt", async () => {
  const calls = [];
  const client = createRazorpayClient({
    keyId: "rzp_test_public",
    keySecret: "sandbox-secret",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => providerOrder };
    },
  });
  const result = await client.createOrder(expected);
  assert.deepEqual(result, { id: providerOrder.id, amountPaise: 1250, currency: "INR", receipt: expected.receipt });
  assert.equal(calls[0].url, "https://api.razorpay.com/v1/orders");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.authorization, `Basic ${Buffer.from("rzp_test_public:sandbox-secret").toString("base64")}`);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    amount: 1250, currency: "INR", receipt: expected.receipt, notes: expected.notes,
  });
});

test("finds an existing order by unique receipt after a retry", async () => {
  const client = createRazorpayClient({
    keyId: "rzp_test_public",
    keySecret: "sandbox-secret",
    fetchImpl: async (url) => {
      assert.equal(url, "https://api.razorpay.com/v1/orders?receipt=rb-attempt123&count=2");
      return { ok: true, json: async () => ({ items: [providerOrder] }) };
    },
  });
  assert.deepEqual(await client.findOrderByReceipt(expected), {
    id: providerOrder.id, amountPaise: 1250, currency: "INR", receipt: expected.receipt,
  });
});

test("refuses live credentials even if supplied to the test-mode client", async () => {
  const client = createRazorpayClient({
    keyId: "rzp_live_key",
    keySecret: "live-secret",
    fetchImpl: async () => { throw new Error("must not make a request"); },
  });
  await assert.rejects(client.createOrder(expected), { code: "PAYMENT_PROVIDER_NOT_CONFIGURED" });
});

test("rejects gateway responses whose amount or receipt differs", async () => {
  const client = createRazorpayClient({
    keyId: "rzp_test_public",
    keySecret: "sandbox-secret",
    fetchImpl: async () => ({ ok: true, json: async () => ({ ...providerOrder, amount: 1 }) }),
  });
  await assert.rejects(client.createOrder(expected), { code: "RAZORPAY_ORDER_MISMATCH" });
});
