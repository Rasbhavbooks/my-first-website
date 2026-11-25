import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import mongoose from "mongoose";
import Order from "../src/modules/orders/order.model.js";
import Attempt from "../src/modules/orders/payment-attempt.model.js";
import PaymentEvent from "../src/modules/orders/payment-event.model.js";
import Ledger from "../src/modules/orders/ledger-transaction.model.js";

test("signed capture updates a book order and posts one receipt across retries", async (t) => {
  const secret = randomBytes(32).toString("hex");
  process.env.RAZORPAY_WEBHOOK_SECRET = secret;
  const { default: app } = await import("../src/app.js");
  const database = "capture_test_" + randomBytes(8).toString("hex");
  await mongoose.connect("mongodb://127.0.0.1:27018/" + database + "?replicaSet=rs0&directConnection=true", {
    serverSelectionTimeoutMS: 10000,
  });
  t.after(async () => {
    try { await mongoose.connection.dropDatabase(); } finally { await mongoose.disconnect(); }
  });
  await Promise.all([Order.init(), Attempt.init(), PaymentEvent.init(), Ledger.init()]);
  const order = await Order.create({
    buyerId: new mongoose.Types.ObjectId(), idempotencyKeyHash: "a".repeat(64),
    bookId: "quiet-river", bookTitle: { en: "Quiet River", gu: "શાંત નદી", hi: "शांत नदी" },
    authorName: "A. Writer", amountPaise: 4900,
  });
  const attempt = new Attempt({ orderId: order._id, attemptNumber: 1, provider: "razorpay",
    amountPaise: 4900, idempotencyKeyHash: "b".repeat(64) });
  attempt.attachProviderOrderId("order_capture1");
  attempt.transitionTo("pending");
  await attempt.save();

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = "http://127.0.0.1:" + server.address().port + "/api/v1/payments/razorpay/webhook";
  const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: {
    id: "pay_capture1", order_id: "order_capture1", amount: 4900, currency: "INR",
  } } } });
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  function notify(id, digest = signature) {
    return fetch(url, { method: "POST", body, headers: {
      "content-type": "application/json", "x-razorpay-event-id": id, "x-razorpay-signature": digest,
    } });
  }

  assert.equal((await notify("evt1", "0".repeat(64))).status, 400);
  assert.equal(await PaymentEvent.countDocuments(), 0);
  const first = await notify("evt1");
  assert.equal(first.status, 200, await first.text());
  for (const result of await Promise.all([notify("evt1"), notify("evt2")])) {
    assert.equal(result.status, 200, await result.text());
  }
  assert.equal((await Order.findById(order._id)).status, "paid");
  const captured = await Attempt.findById(attempt._id).select("+providerPaymentId");
  assert.equal(captured.status, "captured");
  assert.equal(captured.providerPaymentId, "pay_capture1");
  const receipts = await Ledger.find({ orderId: order._id });
  assert.equal(receipts.length, 1);
  assert.deepEqual(receipts[0].entries.map(e => [e.direction, e.amountPaise]).sort(), [["credit", 4900], ["debit", 4900]]);
});
