import { listAdminOrders } from "../src/modules/admin/admin-orders.controller.js";
import { applyConfirmedTestRefund, startFullTestRefund } from "../src/modules/orders/full-refund.service.js";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createHmac, randomBytes } from "node:crypto";
import { reviewAuthorBook } from "../src/modules/books/author-book-admin.controller.js";
import { once } from "node:events";
import { createServer } from "node:net";
import test from "node:test";
import mongoose from "mongoose";
import Book from "../src/modules/books/book.model.js";
import AdminMfa from "../src/modules/auth/admin-mfa.model.js";
import AuthorProfile from "../src/modules/auth/author-profile.model.js";
import AuthorBook from "../src/modules/books/author-book.model.js";
import resolveReadingAccess from "../src/modules/books/reading-access.service.js";
import { listReaderOrders } from "../src/modules/orders/reader-orders.controller.js";
import { getReaderReferralCode } from "../src/modules/orders/reader-referral.js";
import User from "../src/modules/users/user.model.js";
import Order from "../src/modules/orders/order.model.js";
import Attempt from "../src/modules/orders/payment-attempt.model.js";
import PaymentEvent from "../src/modules/orders/payment-event.model.js";
import Entitlement from "../src/modules/orders/book-entitlement.model.js";
import Ledger from "../src/modules/orders/ledger-transaction.model.js";
import { createRefundSubmissionService } from "../src/modules/orders/refund-submission.service.js";
import RefundRequest from "../src/modules/orders/refund-request.model.js";

const secret = randomBytes(32).toString("hex");
const integrationMfaKey = randomBytes(32).toString("hex");

async function startTestScanner(t) {
  const clean = Buffer.from("%PDF-1.7\nClean test input\n");
  const flagged = Buffer.from("%PDF-1.7\nFlagged test input\n");
  const seen = [];
  const server = createServer(socket => {
    let bytes = Buffer.alloc(0);
    socket.on("data", chunk => {
      bytes = Buffer.concat([bytes, chunk]);
      for (const [fixture, response] of [[clean, "stream: OK\0"], [flagged, "stream: TestSignature FOUND\0"]]) {
        const length = Buffer.alloc(4);
        length.writeUInt32BE(fixture.length);
        const expected = Buffer.concat([Buffer.from("zINSTREAM\0"), length, fixture, Buffer.alloc(4)]);
        if (!bytes.equals(expected)) continue;
        seen.push(fixture);
        socket.end(response);
        return;
      }
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise(resolve => server.close(resolve)));
  process.env.CLAMAV_HOST = "127.0.0.1";
  process.env.CLAMAV_PORT = String(server.address().port);
  process.env.R2_ACCOUNT_ID = "";
  return { clean, flagged, seen };
}

async function verifyCheckoutInBrowser(api, buyer, referrer, scanner) {
  const { chromium } = await import("playwright");
  const { preview } = await import("vite");
  const front = await preview({
    configFile: false,
    root: fileURLToPath(new URL("../../client", import.meta.url)),
    preview: { host: "127.0.0.1", port: 0, proxy: { "/api": new URL(api).origin } },
  });
  let browser;
  try {
    browser = await chromium.launch();
    const origin = "http://127.0.0.1:" + front.httpServer.address().port;
    const testCheckout = /Test checkout|ટેસ્ટ ચેકઆઉટ|टेस्ट चेकआउट/;
    const password = randomBytes(24).toString("hex");
    async function signIn(reader, recoveryCode) {
      await reader.setPassword(password);
      reader.emailVerifiedAt = new Date();
      await reader.save();
      const page = await browser.newPage();
      await page.goto(origin + "/" + reader.role + "/login");
      await page.locator('head meta[name="robots"][content="noindex"]').waitFor({ state: "attached" });
      await page.locator('input[name="email"]').fill(reader.email);
      await page.locator('input[name="password"]').fill(password);
      await page.locator('button[type="submit"]').click();
      if (recoveryCode) {
        await page.locator('input[name="adminMfaCode"]').fill(recoveryCode);
        await page.locator('button[type="submit"]').click();
      }
      const landing = { reader: "/", author: "/author/studio", admin: "/admin" };
      await page.waitForURL(origin + landing[reader.role]);
      return page;
    }
    const sharingPage = await signIn(referrer);
    await sharingPage.goto(origin + "/books/phase7-review-paid");
    const shareLabel = /Copy referral link|રેફરલ લિંક કૉપી કરો|रेफरल लिंक कॉपी करें/;
    await sharingPage.getByRole("button", { name: shareLabel }).click();
    const link = await sharingPage.getByRole("textbox", { name: shareLabel }).inputValue();
    const code = await getReaderReferralCode(referrer._id);
    assert.equal(new URL(link).searchParams.get("ref"), code);
    const page = await signIn(buyer);
    await page.goto(link);
    const checkout = page.getByRole("link", { name: testCheckout });
    await checkout.waitFor();
    await page.locator('head meta[name="robots"][content="noindex"]').waitFor({ state: "detached" });
    assert.match(await page.locator("main .detail-price").innerText(), /139\.29/);
    await checkout.click();
    await page.getByRole("heading", { name: testCheckout }).waitFor();
    await page.locator('head meta[name="robots"][content="noindex"]').waitFor({ state: "attached" });
    const summary = await page.locator("main").innerText();
    for (const amount of ["139.29", "6.50", "2.79"]) assert.ok(summary.includes(amount), summary);
    assert.equal(new URL(page.url()).searchParams.get("ref"), code);

    await page.goto(origin + "/books/phase7-review-free?checkout=preview");
    const freePrice = page.locator("main .detail-price");
    await freePrice.waitFor();
    assert.match(await freePrice.innerText(), /free|મફત|मुफ़्त|मुफ्त|निःशुल्क/i);
    assert.equal(await page.getByRole("link", { name: testCheckout }).count(), 0);

    const author = await User.create({
      displayName: "Browser test author", email: "author@example.test",
      passwordHash: "unused-test-hash", accountStatus: "active", role: "author",
    });
    await AuthorProfile.create({
      userId: author._id, slug: "browser-test-author", authorName: author.displayName,
      catalogueAuthorName: author.displayName, writingLanguages: ["English"],
      biography: "An author profile used to verify the book review workflow.",
    });
    const title = "Private browser test manuscript";
    const draft = await AuthorBook.create({
      authorId: author._id, authorName: author.displayName,
      title: { en: title, gu: title, hi: title },
      description: { en: "A manuscript used to verify the private submission workflow." },
      category: "Novel", language: "English", price: 0,
      assets: {
        cover: { key: "test/cover.png", contentType: "image/png", fileName: "cover.png", size: 42, scanStatus: "clean" },
        manuscript: { key: "test/book.pdf", contentType: "application/pdf", fileName: "book.pdf", size: 42, scanStatus: "clean" },
      },
    });
    const authorPage = await signIn(author);
    await authorPage.goto(origin + "/author/books");
    await authorPage.getByRole("button", { name: new RegExp(title) }).click();
    const price = authorPage.locator(".author-book-form input[type=number]");
    const upload = authorPage.waitForResponse(response =>
      response.url().endsWith("/books/" + draft.id + "/assets/manuscript")
      && response.request().method() === "PUT"
    );
    await authorPage.locator('input[type="file"][accept*="application/pdf"]').setInputFiles({
      name: "invalid.pdf", mimeType: "application/pdf", buffer: Buffer.from("This is not a PDF."),
    });
    const rejectedUpload = await upload;
    assert.equal(rejectedUpload.status(), 400);
    assert.equal((await rejectedUpload.json()).error.code, "INVALID_FILE_TYPE");
    for (const [buffer, status, errorCode] of [
      [scanner.flagged, 400, "MALWARE_DETECTED"],
      [scanner.clean, 503, "STORAGE_NOT_CONFIGURED"],
    ]) {
      const uploadResult = authorPage.waitForResponse(response =>
        response.url().endsWith("/books/" + draft.id + "/assets/manuscript")
        && response.request().method() === "PUT"
      );
      await authorPage.locator('input[type="file"][accept*="application/pdf"]').setInputFiles({
        name: "scan-test.pdf", mimeType: "application/pdf", buffer,
      });
      const result = await uploadResult;
      assert.equal(result.status(), status);
      assert.equal((await result.json()).error.code, errorCode);
    }
    assert.deepEqual(scanner.seen, [scanner.flagged, scanner.clean]);
    const unchanged = await AuthorBook.findById(draft._id).lean();
    assert.equal(unchanged.assets.manuscript.fileName, "book.pdf");
    await price.fill("100");
    await authorPage.locator(".author-book-actions button[type=button]").click();
    await price.locator("xpath=self::*[@disabled]").waitFor();
    const submitted = await AuthorBook.findById(draft._id).lean();
    assert.equal(submitted.status, "submitted");
    assert.equal(submitted.price, 100);

    const { createAdminMfaEnrollment, generateRecoveryCodes, hashRecoveryCode } =
      await import("../src/modules/auth/admin-mfa.service.js");
    const admin = await User.create({
      displayName: "Browser test admin", email: "admin@example.test",
      passwordHash: "unused-test-hash", accountStatus: "active", role: "admin", adminMfaEnabled: true,
    });
    const [recoveryCode] = generateRecoveryCodes();
    const enrollment = createAdminMfaEnrollment(admin.email);
    await AdminMfa.create({
      userId: admin._id, enabled: true, encryptedSecret: enrollment.encryptedSecret,
      recoveryCodeHashes: [hashRecoveryCode(recoveryCode)],
    });
    const adminPage = await signIn(admin, recoveryCode);
    await adminPage.goto(origin + "/admin/author-books");
    const card = adminPage.locator(".admin-book-card").filter({ has: adminPage.getByRole("heading", { name: title }) });
    const decision = adminPage.waitForResponse(response =>
      response.url().includes("/admin/author-books/" + draft.id) && response.request().method() !== "GET"
    );
    await card.locator(".admin-book-actions button:not(.secondary)").click();
    assert.equal((await decision).status(), 200);
    const approved = await AuthorBook.findById(draft._id).lean();
    assert.equal(approved.status, "approved");
    assert.equal(approved.price, 100);
    assert.equal(await Book.exists({ author: author.displayName }), null);
  } finally {
    try { await browser?.close(); } finally { await front.close(); }
  }
}

async function verifyPurchase(t, referred) {
  process.env.RAZORPAY_WEBHOOK_SECRET = secret;
  process.env.ADMIN_MFA_ENCRYPTION_KEY = integrationMfaKey;
  const scanner = !referred && process.env.VERIFY_CHECKOUT_BROWSER === "true" ? await startTestScanner(t) : null;
  const { createTestCheckoutService } = await import("../src/modules/orders/test-checkout.service.js");
  const { createRazorpayOrderService } = await import("../src/modules/orders/razorpay-order.service.js");
  if (scanner) process.env.SERVE_BUILT_FRONTEND = "true";
  const { default: app } = await import("../src/app.js");
  const database = "capture_test_" + randomBytes(8).toString("hex");
  const mongoUri = "mongodb://127.0.0.1:27018/" + database + "?replicaSet=rs0&directConnection=true";
  await mongoose.connect(mongoUri, {
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

  const text = { en: "Quiet River", gu: "શાંત નદી", hi: "शांत नदी" };
  const catalogue = await Book.create({
    catalogueId: "quiet-river", title: text, description: text, author: "A. Writer",
    language: "English", category: "Novel", price: 100, availableForSale: true, tone: "blue", badge: "New",
  });
  const [buyer, referrer] = await User.create(["buyer", "referrer"].map(name => ({
    displayName: name, email: name + "@example.test", passwordHash: "unused-test-hash",
    accountStatus: "active", role: "reader",
  })));
  const referralCode = referred ? await getReaderReferralCode(referrer._id) : undefined;
  let gatewayCreations = 0;
  const createGatewayOrder = createRazorpayOrderService({
    findAttemptById: id => Attempt.findById(id).select("+providerOrderId"),
    findOrderById: id => Order.findById(id),
    findProviderOrderByReceipt: async () => null,
    createProviderOrder: async input => {
      gatewayCreations += 1;
      return { ...input, id: "order_capture1" };
    },
    saveAttempt: attempt => attempt.save(),
  });
  const prepareCheckout = createTestCheckoutService({ createGatewayOrder });
  const checkoutInput = {
    mode: "test", buyerId: buyer._id, bookId: catalogue.catalogueId,
    referralCode, idempotencyKey: "capture-integration-order",
  };
  await assert.rejects(prepareCheckout({ ...checkoutInput, mode: "live" }), { code: "LIVE_CHECKOUT_DISABLED" });
  const checkout = await prepareCheckout(checkoutInput);
  assert.deepEqual(await prepareCheckout(checkoutInput), checkout);
  assert.equal(gatewayCreations, 1);
  assert.equal(checkout.providerOrderId, "order_capture1");
  assert.equal(checkout.amountPaise, 13929);
  const order = await Order.findById(checkout.orderId).select("+referrerId");
  const attempt = await Attempt.findById(checkout.attemptId);
  assert.equal(order.amountPaise, 13929);
  assert.equal(order.referrerRewardPaise, referred ? 1000 : 0);
  assert.equal(String(order.referrerId), String(referred ? referrer._id : null));
  assert.equal(attempt.status, "pending");

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const api = "http://127.0.0.1:" + server.address().port + "/api/v1";
  const url = api + "/payments/razorpay/webhook";
  if (!referred) {
    const script = fileURLToPath(new URL("../src/scripts/seedBooks.js", import.meta.url));
    for (let run = 0; run < 2; run += 1) {
      await promisify(execFile)(process.execPath, [script, "--review-fixtures"], {
        env: { ...process.env, NODE_ENV: "test", MONGODB_URI: mongoUri },
        timeout: 15000,
      });
    }
    assert.equal(await Book.countDocuments({ catalogueId: { $in: ["phase7-review-paid", "phase7-review-free"] } }), 2);
    for (const [id, price, total] of [["phase7-review-paid", 100, 13929], ["phase7-review-free", 0, 0]]) {
      const response = await fetch(api + "/books/" + id);
      assert.equal(response.status, 200);
      const { data } = await response.json();
      assert.equal(data.price, price);
      assert.equal(data.customerPricePaise, total);
      if (price) {
        assert.equal(data.priceBreakdownPaise.gst, 650);
        assert.equal(data.priceBreakdownPaise.gatewayFee, 279);
      }
    }
    const origin = new URL(api).origin;
    const robots = await fetch(origin + "/robots.txt");
    assert.equal(robots.status, 200);
    assert.match(await robots.text(), /Sitemap: https?:\/\/[^\s]+\/sitemap\.xml/);
    const sitemap = await fetch(origin + "/sitemap.xml");
    assert.equal(sitemap.status, 200);
    assert.match(sitemap.headers.get("content-type"), /application\/xml/);
    const xml = await sitemap.text();
    assert.ok(xml.includes("/books/phase7-review-paid</loc>"));
    assert.ok(xml.includes("/books/phase7-review-free</loc>"));
    assert.ok(!xml.includes(unlistedDraft.id));
    assert.ok(!xml.includes("/admin/"));
    if (scanner) {
      const publicBook = await fetch(origin + "/books/phase7-review-paid?ref=test");
      assert.equal(publicBook.status, 200);
      const html = await publicBook.text();
      assert.ok(html.includes("<title>Test eBook ₹100 | Rasbhav Books</title>"));
      assert.ok(html.includes('<link rel="canonical"'));
      assert.equal(publicBook.headers.get("x-robots-tag"), null);

      const checkout = await fetch(origin + "/books/phase7-review-paid?checkout=preview");
      assert.equal(checkout.headers.get("x-robots-tag"), "noindex");
      const privatePage = await fetch(origin + "/author/books");
      assert.equal(privatePage.headers.get("x-robots-tag"), "noindex");
      assert.ok(!(await privatePage.text()).includes("Private browser test manuscript"));
      const missing = await fetch(origin + "/books/missing");
      assert.equal(missing.status, 404);
      assert.equal(missing.headers.get("x-robots-tag"), "noindex");
      await verifyCheckoutInBrowser(api, buyer, referrer, scanner);
    }
  }
  const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: {
    id: "pay_capture1", order_id: "order_capture1", amount: 13929, currency: "INR",
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
    id: "pay_duplicate1", order_id: "order_capture1", amount: 13929, currency: "INR",
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
  assert.equal(duplicateRefund.amountPaise, 13929);
  assert.equal(duplicateRefund.providerPaymentId, "pay_duplicate1");
  let refundCalls = 0;
  const submitRefund = createRefundSubmissionService({
    mode: "test",
    findRefundRequestById: id => RefundRequest.findById(id).select("+providerPaymentId +providerRefundId"),
    refundCapturedPayment: async ({ paymentId, amountPaise, currency }) => {
      assert.equal(paymentId, "pay_duplicate1");
      assert.equal(amountPaise, 13929);
      assert.equal(currency, "INR");
      refundCalls += 1;
      return { status: "completed", refundId: "rfnd_duplicate1" };
    },
  });
  assert.equal((await submitRefund(duplicateRefund.id)).completed, true);
  assert.equal((await RefundRequest.findById(duplicateRefund._id)).status, "completed");
  assert.equal((await submitRefund(duplicateRefund.id)).replayed, true);
  assert.equal(refundCalls, 1);
  async function historyFor(reader) {
    return listReaderOrders({ reader, query: {} }, {
      setHeader() {},
      json(body) { return body.data; },
    });
  }
  const referrerHistory = await historyFor(referrer);
  assert.equal(referrerHistory.referralRewardPaise, referred ? 1000 : 0);
  assert.deepEqual(referrerHistory.orders, []);
  const buyerHistory = await historyFor(buyer);
  assert.equal(buyerHistory.referralRewardPaise, 0);
  assert.deepEqual(buyerHistory.orders[0].fees, { gstPaise: 650, gatewayFeePaise: 279 });
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
  assert.deepEqual(receipts[0].entries.map(e => [e.accountCode, e.direction, e.amountPaise]).sort(), [
    ["author_payable", "credit", 10000], ["gateway_clearing", "debit", 13929],
    ["gateway_fee_payable", "credit", 279], ["platform_commission", "credit", referred ? 2000 : 3000],
    ...(referred ? [["referrer_payable", "credit", 1000]] : []),
    ["tax_payable", "credit", 650],
  ]);
  const readerId = order.buyerId;
  const otherReaderId = new mongoose.Types.ObjectId();
  const source = await AuthorBook.create({
    authorId: otherReaderId, authorName: order.authorName, title: text, description: text, price: 100,
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
  const startRefund = { mode: "test", orderId: order._id };
  assert.deepEqual(await startFullTestRefund(startRefund), { replayed: false });
  assert.deepEqual(await startFullTestRefund(startRefund), { replayed: true });
  assert.equal((await Attempt.findById(attempt._id)).status, "refund_pending");
  assert.deepEqual(await resolveReadingAccess({ bookId: catalogue.catalogueId, readerId }),
    { sourceId: String(source._id), kind: "purchased" });
  assert.equal((await historyFor(referrer)).referralRewardPaise, referred ? 1000 : 0);
  const fullRefund = {
    mode: "test", orderId: order._id,
    confirmation: { status: "completed", amountPaise: 13929, currency: "INR",
      refundId: "rfnd_full1", paymentId: "pay_capture1" },
  };
  await assert.rejects(applyConfirmedTestRefund({ ...fullRefund, mode: "live" }), { code: "LIVE_REFUNDS_DISABLED" });
  await assert.rejects(applyConfirmedTestRefund({
    ...fullRefund, confirmation: { ...fullRefund.confirmation, paymentId: "pay_duplicate1" },
  }), { code: "INVALID_FULL_REFUND" });
  assert.equal((await Order.findById(order._id)).status, "refund_pending");
  assert.deepEqual(await applyConfirmedTestRefund(fullRefund), { replayed: false, amountPaise: 13929 });
  assert.deepEqual(await applyConfirmedTestRefund(fullRefund), { replayed: true, amountPaise: 13929 });
  assert.equal(await Ledger.countDocuments({ orderId: order._id, eventType: "refund" }), 1);
  const adminHistory = await listAdminOrders({ query: { status: "refunded" } }, {
    setHeader() {},
    json(body) { return body.data; },
  });
  assert.equal(adminHistory.orders[0].id, order.id);
  assert.equal(adminHistory.orders[0].recordStatus, "refund_linked");
  const reversal = await Ledger.findOne({ orderId: order._id, eventType: "refund" });
  assert.deepEqual(reversal.entries.map(e => [e.accountCode, e.direction, e.amountPaise]).sort(), [
    ["author_payable", "debit", 10000], ["gateway_clearing", "credit", 13929],
    ["gateway_fee_expense", "debit", 279], ["platform_commission", "debit", referred ? 2000 : 3000],
    ...(referred ? [["referrer_payable", "debit", 1000]] : []),
    ["tax_payable", "debit", 650],
  ]);
  assert.equal((await Order.findById(order._id)).status, "refunded");
  assert.equal((await Attempt.findById(attempt._id)).status, "refunded");
  assert.equal((await historyFor(referrer)).referralRewardPaise, 0);
  assert.equal(await resolveReadingAccess({ bookId: catalogue.catalogueId, readerId }), null);
  await Book.updateOne({ _id: catalogue._id }, { $set: { price: 0 } });
  assert.equal(await resolveReadingAccess({ bookId: catalogue.catalogueId, readerId }), null);
  await AuthorBook.updateOne({ _id: source._id }, { $set: { price: 0 } });
  assert.equal(await resolveReadingAccess({ bookId: catalogue.catalogueId }), null);
  assert.deepEqual(await resolveReadingAccess({ bookId: catalogue.catalogueId, readerId: otherReaderId }),
    { sourceId: String(source._id), kind: "free" });
}

test("direct purchase retains its itemized receipt and access after a duplicate refund", t => verifyPurchase(t, false));
test("referred purchase retains its itemized receipt and access after a duplicate refund", t => verifyPurchase(t, true));
