import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { reviewAuthorBook } from "../src/modules/books/author-book-admin.controller.js";
import { once } from "node:events";
import test from "node:test";
import mongoose from "mongoose";
import Book from "../src/modules/books/book.model.js";
import AuthorBook from "../src/modules/books/author-book.model.js";
import resolveReadingAccess from "../src/modules/books/reading-access.service.js";
import Order from "../src/modules/orders/order.model.js";
import Attempt from "../src/modules/orders/payment-attempt.model.js";
import PaymentEvent from "../src/modules/orders/payment-event.model.js";
import Entitlement from "../src/modules/orders/book-entitlement.model.js";
import Ledger from "../src/modules/orders/ledger-transaction.model.js";
import RefundRequest from "../src/modules/orders/refund-request.model.js";

test("signed capture updates a book order and posts one receipt and grants one entitlement across retries", async (t) => {
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
  await Promise.all([Order.init(), Attempt.init(), PaymentEvent.init(), Ledger.init(), Entitlement.init(), RefundRequest.init(), Book.init(), AuthorBook.init()]);

  const unpublishedAuthorName = "Rights gate test " + randomBytes(4).toString("hex");
  const unlistedDraft = await AuthorBook.create({
    authorId: new mongoose.Types.ObjectId(),
    authorName: unpublishedAuthorName,
    title: { en: "Private review draft", gu: "ખાનગી સમીક્ષા ડ્રાફ્ટ", hi: "निजी समीक्षा ड्राफ्ट" },
    description: { en: "Integration test draft.", gu: "ઇન્ટિગ્રેશન ટેસ્ટ ડ્રાફ્ટ.", hi: "इंटीग्रेशन परीक्षण ड्राफ्ट।" },
    language: "English",
    category: "Novel",
    price: 0,
    status: "submitted",
    submittedAt: new Date(),
  });
  const reviewResponse = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    setHeader() {},
    json(body) { this.body = body; return this; },
  };
  await reviewAuthorBook({
    params: { bookId: String(unlistedDraft._id) },
    reader: { _id: new mongoose.Types.ObjectId() },
    body: { decision: "approved", reviewedPrice: 0, submittedAt: unlistedDraft.submittedAt.toISOString() },
  }, reviewResponse);
  assert.equal(reviewResponse.statusCode, 200);
  assert.equal(reviewResponse.body.data.book.status, "approved");
  assert.equal(reviewResponse.body.data.book.price, 0);
  assert.equal(await Book.countDocuments({ author: unpublishedAuthorName }), 0);
  assert.equal(await resolveReadingAccess({ bookId: String(unlistedDraft._id), readerId: unlistedDraft.authorId }), null);

  const order = await Order.create({
    buyerId: new mongoose.Types.ObjectId(), idempotencyKeyHash: "a".repeat(64),
    bookId: "quiet-river", bookTitle: { en: "Quiet River", gu: "શાંત નદી", hi: "शांत नदी" },
    authorName: "A. Writer", amountPaise: 4900, authorPricePaise: 3769, commissionRateBps: 3000,
    platformCommissionPaise: 1131, referralRateBps: 0, referrerRewardPaise: 0,
    referrerId: null, gstRateBps: 0, gstPaise: 0, gatewayRateBps: 0, gatewayFeePaise: 0,
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
  // A conflicting record must prevent both the paid transition and the journal write.
  const conflicting = await Entitlement.create({
    readerId: new mongoose.Types.ObjectId(), bookId: order.bookId, orderId: order._id,
    sourceLedgerId: new mongoose.Types.ObjectId(), amountPaise: order.amountPaise, currency: "INR",
  });
  assert.equal((await notify("evt1")).status, 500);
  assert.equal((await Order.findById(order._id)).status, "pending_payment");
  assert.equal((await Attempt.findById(attempt._id)).status, "pending");
  assert.equal(await Ledger.countDocuments({ orderId: order._id }), 0);
  await Entitlement.deleteOne({ _id: conflicting._id });

  const first = await notify("evt1");
  assert.equal(first.status, 200, await first.text());
  for (const result of await Promise.all([notify("evt1"), notify("evt2")])) {
    assert.equal(result.status, 200, await result.text());
  }
  assert.equal((await Order.findById(order._id)).status, "paid");
  const duplicateBody = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: {
    id: "pay_duplicate1", order_id: "order_capture1", amount: 4900, currency: "INR",
  } } } });
  const duplicateSignature = createHmac("sha256", secret).update(duplicateBody).digest("hex");
  const duplicateResponse = await fetch(url, { method: "POST", body: duplicateBody, headers: {
    "content-type": "application/json", "x-razorpay-event-id": "evt_duplicate", "x-razorpay-signature": duplicateSignature,
  } });
  assert.equal(duplicateResponse.status, 200, await duplicateResponse.text());
  const duplicateEvent = await PaymentEvent.findOne({ provider: "razorpay", eventId: "evt_duplicate" }).select("+providerPaymentId");
  assert.ok(duplicateEvent);
  assert.equal(duplicateEvent.providerPaymentId, "pay_duplicate1");
  const duplicateRefund = await RefundRequest.findOne({ sourcePaymentEventId: duplicateEvent._id }).select("+providerPaymentId");
  assert.ok(duplicateRefund);
  assert.equal(duplicateRefund.status, "pending");
  assert.equal(duplicateRefund.amountPaise, 4900);
  assert.equal(duplicateRefund.providerPaymentId, "pay_duplicate1");
  assert.equal((await Order.findById(order._id)).status, "paid");
  assert.equal(await Ledger.countDocuments({ orderId: order._id }), 1);
  assert.equal(await Entitlement.countDocuments({ orderId: order._id }), 1);
  const captured = await Attempt.findById(attempt._id).select("+providerPaymentId");
  assert.equal(captured.status, "captured");
  assert.equal(captured.providerPaymentId, "pay_capture1");
  const receipts = await Ledger.find({ orderId: order._id });
  assert.equal(receipts.length, 1);
  const grants = await Entitlement.find({ orderId: order._id }).select("+sourceLedgerId");
  assert.equal(grants.length, 1);
  assert.equal(String(grants[0].readerId), String(order.buyerId));
  assert.equal(grants[0].bookId, order.bookId);
  assert.equal(String(grants[0].sourceLedgerId), String(receipts[0]._id));
  assert.deepEqual(receipts[0].entries.map(e => [e.direction, e.amountPaise]).sort(), [["credit", 1131], ["credit", 3769], ["debit", 4900]]);
  const readerId = order.buyerId;
  const otherReaderId = new mongoose.Types.ObjectId();
  const text = { en: "Quiet River", gu: "શાંત નદી", hi: "शांत नदी" };
  const catalogue = await Book.create({
    catalogueId: order.bookId, title: text, description: text,
    author: order.authorName, language: "English", category: "Novel", price: 49,
    tone: "blue", badge: "New",
  });
  const source = await AuthorBook.create({
    authorId: otherReaderId, authorName: order.authorName, title: text, description: text, price: 49,
    assets: { manuscript: { key: "private/test/reading.pdf", contentType: "application/pdf",
      fileName: "reading.pdf", size: 512, scanStatus: "clean" } },
  });
  assert.equal(await resolveReadingAccess({ bookId: catalogue.catalogueId, readerId }), null);
  await Book.updateOne({ _id: catalogue._id }, { $set: { readingSourceId: source._id } });
  assert.equal((await Book.findById(catalogue._id).lean()).readingSourceId, undefined);
  assert.equal(await resolveReadingAccess({ bookId: catalogue.catalogueId, readerId }), null);
  await AuthorBook.updateOne({ _id: source._id }, { $set: { status: "approved" } });
  assert.deepEqual(await resolveReadingAccess({ bookId: catalogue.catalogueId, readerId }),
    { sourceId: String(source._id), kind: "purchased" });
  assert.equal(await resolveReadingAccess({ bookId: catalogue.catalogueId, readerId: otherReaderId }), null);
  assert.equal(await resolveReadingAccess({ bookId: catalogue.catalogueId }), null);
  const paid = await Order.findById(order._id).select("+paymentReference");
  paid.transitionTo("refund_pending");
  await paid.save();
  assert.equal(await resolveReadingAccess({ bookId: catalogue.catalogueId, readerId }), null);
  await Book.updateOne({ _id: catalogue._id }, { $set: { price: 0 } });
  assert.equal(await resolveReadingAccess({ bookId: catalogue.catalogueId, readerId }), null);
  await AuthorBook.updateOne({ _id: source._id }, { $set: { price: 0 } });
  assert.equal(await resolveReadingAccess({ bookId: catalogue.catalogueId }), null);
  assert.deepEqual(await resolveReadingAccess({ bookId: catalogue.catalogueId, readerId: otherReaderId }),
    { sourceId: String(source._id), kind: "free" });
});
