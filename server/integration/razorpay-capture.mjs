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
      if (reader.id === buyer.id) {
        await page.goto(origin + "/admin/login");
        await page.locator('input[name="email"]').fill(reader.email);
        await page.locator('input[name="password"]').fill(password);
        const wrongPortal = page.waitForResponse(response => response.url().endsWith("/api/v1/auth/login"));
        await page.locator('button[type="submit"]').click();
        const rejected = await wrongPortal;
        assert.equal(rejected.status(), 403);
        assert.equal((await rejected.json()).error.code, "ROLE_LOGIN_MISMATCH");
        await page.getByRole("alert").waitFor();
        assert.ok(!(await page.context().cookies()).some(cookie => cookie.name === "rasbhav_reader_session"));
      }
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

    const freeBook = await Book.findOne({ catalogueId: "phase7-review-free" }).lean();
    const readingSource = await AuthorBook.create({
      authorId: new mongoose.Types.ObjectId(), authorName: freeBook.author,
      title: freeBook.title, description: freeBook.description, price: 0, status: "approved",
      assets: { manuscript: { key: "test/reading-goal.pdf", contentType: "application/pdf",
        fileName: "reading-goal.pdf", size: 42, scanStatus: "clean" } },
    });
    await Book.updateOne({ _id: freeBook._id }, { $set: { readingSourceId: readingSource._id } });
    const readerUrl = origin + "/read/" + freeBook.catalogueId;
    const mark = /Mark as read|વાંચી લીધું|पढ़ लिया/;
    const undo = /Remove completion|વાંચ્યાની નોંધ દૂર કરો|पढ़ने की प्रविष्टि हटाएँ/;
    await page.goto(readerUrl);
    await page.getByRole("button", { name: mark }).click();
    await page.getByRole("button", { name: undo }).waitFor();
    await page.goto(origin + "/library");
    await page.locator('progress[max="3"][value="1"]').waitFor();
    assert.deepEqual(await page.locator(".reading-streak dd").allTextContents(), ["1", "1"]);
    const reminderLabel = /Remind me in the library|લાઇબ્રેરીમાં વાંચન લક્ષ્ય યાદ અપાવો|लाइब्रेरी में पढ़ने का लक्ष्य याद दिलाएँ/;
    const reminder = page.getByRole("checkbox", { name: reminderLabel });
    await reminder.waitFor();
    assert.equal(await reminder.isChecked(), false);
    const enableReminder = page.waitForResponse(response =>
      response.url().endsWith('/challenge/reminder') && response.request().method() === 'PUT'
    );
    await reminder.click();
    assert.equal((await enableReminder).status(), 200);
    await page.locator('section[aria-labelledby="reading-challenge-title"] input:checked').waitFor();
    await page.reload();
    await page.locator('section[aria-labelledby="reading-challenge-title"] input:checked').waitFor();
    const disableReminder = page.waitForResponse(response =>
      response.url().endsWith('/challenge/reminder') && response.request().method() === 'PUT'
    );
    await reminder.click();
    assert.equal((await disableReminder).status(), 200);
    await page.locator('section[aria-labelledby="reading-challenge-title"] input:not(:checked)').waitFor();
    const recommendations = page.locator('section[aria-labelledby="library-recommendations"]');
    await recommendations.locator('a[href="/books/phase7-review-paid"]').waitFor();
    assert.equal(await recommendations.locator('a[href="/books/phase7-review-free"]').count(), 0);
    const otherRecommendations = await sharingPage.evaluate(async () => {
      const response = await fetch("/api/v1/reader/library/recommendations");
      return { status: response.status, body: await response.json() };
    });
    assert.equal(otherRecommendations.status, 200, JSON.stringify(otherRecommendations.body));
    assert.deepEqual(otherRecommendations.body.data.books, []);
    await sharingPage.goto(origin + "/library");
    await sharingPage.locator('progress[max="3"][value="0"]').waitFor();
    const completedBooks = page.locator('section[aria-labelledby="reading-challenge-title"]');
    await completedBooks.getByRole("button", { name: undo }).click();
    await page.locator('progress[max="3"][value="0"]').waitFor();
    await completedBooks.getByRole("button", { name: undo }).waitFor({ state: "detached" });
    await page.goto(readerUrl);
    await page.getByRole("button", { name: mark }).waitFor();

    const discussionBookUrl = origin + "/books/phase7-review-paid";
    const discussionBody = "Browser test reader discussion for this book.";
    await page.goto(discussionBookUrl);
    const discussion = page.locator('section[aria-labelledby="book-discussion-title"]');
    await discussion.locator("textarea").fill(discussionBody);
    const submittedPost = page.waitForResponse(response =>
      response.url().endsWith("/discussions") && response.request().method() === "POST"
    );
    await discussion.locator('button[type="submit"]').click();
    const posted = await submittedPost;
    assert.equal(posted.status(), 201);
    const postId = (await posted.json()).data.post.id;
    const visiblePosts = await page.evaluate(async () => {
      const response = await fetch("/api/v1/books/phase7-review-paid/discussions");
      return response.json();
    });
    assert.deepEqual(visiblePosts.data.posts, []);
    assert.deepEqual((await (await fetch(api + "/community/discussions")).json()).data.books, []);

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
    await adminPage.goto(origin + "/admin/discussions");
    const modPost = adminPage.locator("main.book-discussion li").filter({ hasText: discussionBody });
    await modPost.locator("button").first().click();
    await modPost.waitFor({ state: "detached" });

    await sharingPage.goto(origin + "/community");
    await sharingPage.locator('main a[href="/books/phase7-review-paid#book-discussion-title"]').click();
    assert.equal(new URL(sharingPage.url()).hash, "#book-discussion-title");
    const publicPost = sharingPage.locator("section.book-discussion li").filter({ hasText: discussionBody });
    const replyBody = "A reply from another reader in the discussion.";
    await publicPost.locator(".discussion-replies > button").click();
    const thread = sharingPage.locator("#book-discussion-" + postId);
    await thread.locator("textarea").fill(replyBody);
    const replySubmitted = sharingPage.waitForResponse(response =>
      response.url().endsWith("/replies") && response.request().method() === "POST"
    );
    await thread.locator('button[type="submit"]').click();
    const replyResponse = await replySubmitted;
    assert.equal(replyResponse.status(), 201);
    assert.equal((await replyResponse.json()).data.post.parentId, postId);
    assert.equal(await thread.getByText(replyBody, { exact: true }).count(), 0);
    await adminPage.reload();
    const modReply = adminPage.locator("main.book-discussion li").filter({ hasText: replyBody });
    await modReply.locator("button").first().click();
    await modReply.waitFor({ state: "detached" });
    await sharingPage.reload();
    await publicPost.locator(".discussion-replies > button").click();
    await thread.getByText(replyBody, { exact: true }).waitFor();

    const firstLike = publicPost.locator('button[aria-pressed="false"]').first();
    await firstLike.click();
    await publicPost.locator('button[aria-pressed="true"]').first().waitFor();
    const duplicateLike = await sharingPage.evaluate(async id => {
      const result = await fetch("/api/v1/books/phase7-review-paid/discussions/" + id + "/like", { method: "PUT" });
      return { status: result.status, body: await result.json() };
    }, postId);
    assert.equal(duplicateLike.status, 200);
    assert.deepEqual(duplicateLike.body.data, { liked: true, likeCount: 1 });
    await sharingPage.reload();
    await publicPost.locator('button[aria-pressed="true"]').first().click();
    await publicPost.locator('button[aria-pressed="false"]').first().waitFor();

    await publicPost.getByRole("button", { name: /Hide this reader|આ વાચકની નોંધો છુપાવો|इस पाठक की पोस्ट छिपाएँ/ }).click();
    await publicPost.waitFor({ state: "detached" });
    const guestPosts = await sharingPage.evaluate(async () => (await fetch("/api/v1/books/phase7-review-paid/discussions")).json());
    assert.equal(guestPosts.data.posts[0].id, postId);
    await sharingPage.getByText(/^(Hidden readers|છુપાવેલા વાચકો|छिपाए गए पाठक)$/).click();
    await sharingPage.getByRole("button", { name: /Show again|ફરી બતાવો|फिर दिखाएँ/ }).click();
    await publicPost.waitFor();

    const report = sharingPage.waitForResponse(response =>
      response.url().endsWith("/report") && response.request().method() === "POST"
    );
    await publicPost.getByRole("button").first().click();
    await publicPost.locator('select[name="reason"]').selectOption("spam");
    await publicPost.locator('form button[type="submit"]').click();
    assert.equal((await report).status(), 200);
    await adminPage.reload();
    await modPost.getByText(/^(Spam|સ્પામ|स्पैम) · 1$/).waitFor();
    await modPost.locator("button").last().click();
    await modPost.waitFor({ state: "detached" });
    await sharingPage.reload();
    const hiddenPosts = await sharingPage.evaluate(async () => {
      const response = await fetch("/api/v1/books/phase7-review-paid/discussions");
      return response.json();
    });
    assert.deepEqual(hiddenPosts.data.posts, []);
    assert.deepEqual((await (await fetch(api + "/community/discussions")).json()).data.books, []);
    const hiddenThread = await sharingPage.evaluate(async id => (await fetch("/api/v1/books/phase7-review-paid/discussions/" + id + "/replies")).status, postId);
    assert.equal(hiddenThread, 404);
    await page.goto(origin + "/community");
    const myPost = page.locator('section[aria-labelledby="my-discussion-title"] li').filter({ hasText: discussionBody });
    await myPost.getByText(/^(Hidden|છુપાવેલી|छिपाई गई)$/).waitFor();
    const markDecision = /Mark as read|વાંચેલું ગણો|पढ़ा हुआ मानें/;
    await myPost.getByRole("button", { name: markDecision }).click();
    await myPost.getByRole("button", { name: markDecision }).waitFor({ state: "detached" });
    await page.reload();
    await myPost.waitFor();
    assert.equal(await myPost.getByRole("button", { name: markDecision }).count(), 0);
    const otherHistory = await sharingPage.evaluate(async () => (await fetch("/api/v1/community/my-discussions")).json());
    assert.ok(otherHistory.data.posts.every(post => post.body !== discussionBody));
    const deniedRemoval = await sharingPage.evaluate(async id => (await fetch(
      "/api/v1/community/my-discussions/" + id, { method: "DELETE" },
    )).status, postId);
    assert.equal(deniedRemoval, 404);
    await myPost.waitFor();
    page.once("dialog", dialog => dialog.accept());
    await myPost.getByRole("button", { name: /Remove post|નોંધ દૂર કરો|पोस्ट हटाएँ/ }).click();
    await myPost.waitFor({ state: "detached" });
    await page.reload();
    await page.locator('section[aria-labelledby="my-discussion-title"]').waitFor();
    const myHistory = await page.evaluate(async () => (await fetch("/api/v1/community/my-discussions")).json());
    assert.ok(myHistory.data.posts.every(post => post.id !== postId));
    const replyHistory = await sharingPage.evaluate(async () => (await fetch("/api/v1/community/my-discussions")).json());
    assert.equal(replyHistory.data.posts.find(post => post.body === replyBody).status, "hidden");

    const adminClubs = adminPage.locator('section[aria-labelledby="reading-clubs-title"]');
    await adminClubs.locator("input").fill("phase7-review-paid");
    await adminClubs.locator('button[type="submit"]').click();
    await adminClubs.locator("li").waitFor();
    const indiaTime = new Date(Date.now() + 7 * 86400000 + 330 * 60000).toISOString().slice(0, 16);
    const expectedMeeting = new Date(indiaTime + ":00+05:30").toISOString();
    await adminClubs.locator('input[name="meetingAt"]').fill(indiaTime);
    await adminClubs.locator('input[name="meetingNote"]').fill("Discuss the opening chapters.");
    await adminClubs.locator('li form button[type="submit"]').click();
    await adminClubs.locator("time").waitFor();
    await sharingPage.goto(origin + "/community");
    const readerClub = sharingPage.locator('section[aria-labelledby="reading-clubs-title"] li');
    assert.equal(await readerClub.locator("time").getAttribute("datetime"), expectedMeeting);
    await readerClub.getByText(/Discuss the opening chapters/).waitFor();
    await readerClub.getByRole("button", { name: /Join club|જોડાઓ|जुड़ें/ }).click();
    await readerClub.getByRole("button", { name: /Leave club|ક્લબ છોડો|क्लब छोड़ें/ }).waitFor();
    const attending = /I’m attending|હું આવીશ|मैं आऊँगा/;
    const withdraw = /Withdraw RSVP|હાજરી પાછી ખેંચો|उपस्थिति वापस लें/;
    await readerClub.getByRole("button", { name: attending }).click();
    await readerClub.getByRole("button", { name: withdraw }).waitFor();
    await sharingPage.reload();
    await readerClub.getByRole("button", { name: withdraw }).waitFor();
    assert.equal((await (await fetch(api + "/community/clubs")).json()).data.clubs[0].attendanceCount, 1);
    await readerClub.getByRole("button", { name: /Leave club|ક્લબ છોડો|क्लब छोड़ें/ }).click();
    await readerClub.getByRole("button", { name: /Join club|જોડાઓ|जुड़ें/ }).waitFor();
    assert.equal((await (await fetch(api + "/community/clubs")).json()).data.clubs[0].attendanceCount, 0);
    const cancelled = adminPage.waitForResponse(response => response.url().endsWith("/meeting") && response.request().method() === "PATCH");
    await adminClubs.getByRole("button", { name: /Cancel meeting|બેઠક રદ કરો|बैठक रद्द करें/ }).click();
    assert.equal((await cancelled).status(), 200);
    assert.equal((await (await fetch(api + "/community/clubs")).json()).data.clubs[0].meetingAt, null);
    const archive = adminPage.waitForResponse(response => response.url().includes("/api/v1/admin/clubs/") && response.request().method() === "PATCH");
    await adminClubs.getByRole("button", { name: /Close club|ક્લબ બંધ કરો|क्लब बंद करें/ }).click();
    assert.equal((await archive).status(), 200);
    assert.deepEqual((await (await fetch(api + "/community/clubs")).json()).data.clubs, []);
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
  const otherReaderId = new mongoose.Types.ObjectId();
  const source = await AuthorBook.create({
    authorId: otherReaderId, authorName: "A. Writer", title: text, description: text, price: 100, status: "approved",
    assets: { manuscript: { key: "private/test/reading.pdf", contentType: "application/pdf",
      fileName: "reading.pdf", size: 512, scanStatus: "clean" } },
  });
  const catalogue = await Book.create({
    catalogueId: "quiet-river", title: text, description: text, author: "A. Writer",
    language: "English", category: "Novel", price: 100, availableForSale: true, readingSourceId: source._id, tone: "blue", badge: "New",
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
  const order = await Order.findById(checkout.orderId).select("+referrerId +authorBeneficiaryId");
  assert.equal(String(order.authorBeneficiaryId), String(otherReaderId));
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
  const { getAuthorOrderShare } = await import("../src/modules/auth/authors.controller.js");
  assert.deepEqual(await getAuthorOrderShare(otherReaderId), { amountPaise: 10000, orderCount: 1 });
  assert.deepEqual(await getAuthorOrderShare(buyer._id), { amountPaise: 0, orderCount: 0 });
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
  await Book.updateOne({ _id: catalogue._id }, { $unset: { readingSourceId: 1 } });
  await AuthorBook.updateOne({ _id: source._id }, { $set: { status: "draft" } });
  assert.equal(await resolveReadingAccess({ bookId: catalogue.catalogueId, readerId }), null);
  await Book.updateOne({ _id: catalogue._id }, { $set: { readingSourceId: source._id } });
  assert.equal((await Book.findById(catalogue._id).lean()).readingSourceId, undefined);
  assert.equal(await resolveReadingAccess({ bookId: catalogue.catalogueId, readerId }), null);
  await AuthorBook.updateOne({ _id: source._id }, { $set: { status: "approved" } });
  assert.deepEqual(await resolveReadingAccess({ bookId: catalogue.catalogueId, readerId }),
    { sourceId: String(source._id), kind: "purchased" });
  assert.equal(await resolveReadingAccess({ bookId: catalogue.catalogueId, readerId: otherReaderId }), null);
  assert.equal(await resolveReadingAccess({ bookId: catalogue.catalogueId }), null);
  const { getReadingChallenge, saveReadingCompletion, deleteReadingCompletion, challengeMonthStart, readingReminderDue, calculateReadingStreak } =
    await import("../src/modules/orders/reader-challenge.js");
  assert.equal(challengeMonthStart(new Date("2026-11-30T18:30:00Z")).toISOString(), "2026-11-30T18:30:00.000Z");
  assert.equal(readingReminderDue(new Date("2026-11-25T12:00:00Z"), 2), true);
  assert.equal(readingReminderDue(new Date("2026-11-25T12:00:00Z"), 3), false);
  assert.equal(readingReminderDue(new Date("2026-11-10T12:00:00Z"), 2), false);
  const readingDates = ["2026-11-28T19:00:00Z", "2026-11-29T08:00:00Z", "2026-11-29T19:00:00Z"].map(value => new Date(value));
  assert.deepEqual(calculateReadingStreak(readingDates, new Date("2026-12-01T05:00:00Z")), { current: 2, longest: 2 });
  assert.deepEqual(calculateReadingStreak(readingDates, new Date("2026-12-02T05:00:00Z")), { current: 0, longest: 2 });
  const completionRequest = { reader: { _id: readerId }, params: { bookId: catalogue.catalogueId } };
  const response = { set() { return this; }, status(value) { this.statusCode = value; return this; }, json(body) { return body.data; } };
  await saveReadingCompletion({ ...completionRequest, reader: { _id: otherReaderId } }, response);
  assert.equal(response.statusCode, 404);
  assert.deepEqual(await saveReadingCompletion(completionRequest, response), { completed: true });
  await saveReadingCompletion(completionRequest, response);
  const challenge = await getReadingChallenge(completionRequest, response);
  assert.equal(challenge.completed, 1);
  assert.equal(challenge.target, 3);
  assert.deepEqual(challenge.streak, { current: 1, longest: 1 });
  assert.equal(challenge.books.length, 1);
  assert.equal(challenge.books[0].bookId, catalogue.catalogueId);
  assert.equal(challenge.books[0].title.en, catalogue.title.en);
  assert.deepEqual(await getReadingChallenge({ reader: { _id: otherReaderId } }, response), { completed: 0, target: 3, books: [], reminderEnabled: false, reminderDue: false, streak: { current: 0, longest: 0 } });
  await deleteReadingCompletion(completionRequest, response);
  assert.deepEqual(await getReadingChallenge(completionRequest, response), { completed: 0, target: 3, books: [], reminderEnabled: false, reminderDue: false, streak: { current: 0, longest: 0 } });

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
  assert.deepEqual(adminHistory.paymentTotals, [
    { status: "paid", count: 0, amountPaise: 0 },
    { status: "refund_pending", count: 0, amountPaise: 0 },
    { status: "refunded", count: 1, amountPaise: 13929 },
  ]);
  const reversal = await Ledger.findOne({ orderId: order._id, eventType: "refund" });
  assert.deepEqual(reversal.entries.map(e => [e.accountCode, e.direction, e.amountPaise]).sort(), [
    ["author_payable", "debit", 10000], ["gateway_clearing", "credit", 13929],
    ["gateway_fee_expense", "debit", 279], ["platform_commission", "debit", referred ? 2000 : 3000],
    ...(referred ? [["referrer_payable", "debit", 1000]] : []),
    ["tax_payable", "debit", 650],
  ]);
  assert.equal((await Order.findById(order._id)).status, "refunded");
  assert.equal((await Attempt.findById(attempt._id)).status, "refunded");
  assert.deepEqual(await getAuthorOrderShare(otherReaderId), { amountPaise: 0, orderCount: 0 });
  assert.equal((await historyFor(referrer)).referralRewardPaise, 0);
  assert.equal(await resolveReadingAccess({ bookId: catalogue.catalogueId, readerId }), null);
  await Book.updateOne({ _id: catalogue._id }, { $set: { price: 0 } });
  assert.equal(await resolveReadingAccess({ bookId: catalogue.catalogueId, readerId }), null);
  await AuthorBook.updateOne({ _id: source._id }, { $set: { price: 0 } });
  assert.equal(await resolveReadingAccess({ bookId: catalogue.catalogueId }), null);
  assert.deepEqual(await resolveReadingAccess({ bookId: catalogue.catalogueId, readerId: otherReaderId }),
    { sourceId: String(source._id), kind: "free" });
}

test("private Razorpay command verifies the sandbox and prepares a retry-safe test order", async t => {
  const database = "razorpay_sandbox_" + randomBytes(6).toString("hex");
  const uri = "mongodb://127.0.0.1:27018/" + database + "?replicaSet=rs0&directConnection=true";
  const connection = await mongoose.createConnection(uri).asPromise();
  t.after(async () => {
    try { await connection.dropDatabase(); } finally { await connection.close(); }
  });
  const email = "sandbox@example.test";
  await connection.collection("users").insertOne({
    email, role: "reader", accountStatus: "active", emailVerifiedAt: new Date(),
  });

  // Run the real CLI in a child process with only the outbound Razorpay API stubbed.
  const mock = `data:text/javascript,${encodeURIComponent(`
    globalThis.fetch = async (url, options) => {
      if (new URL(url).origin !== "https://api.razorpay.com") throw new Error("Unexpected URL");
      if (options.method === "GET") return Response.json({ items: [] });
      const { amount, currency, receipt } = JSON.parse(options.body);
      return Response.json({ id: "order_Sandbox123", amount, currency, receipt });
    };
  `)}`;
  const script = fileURLToPath(new URL("../src/scripts/prepareRazorpaySandboxOrder.js", import.meta.url));
  const run = (databaseName, overrides = {}) => promisify(execFile)(process.execPath, [
    "--import", mock, script, "--test-database", databaseName,
    "--reader-email", email, "--idempotency-key", "razorpay-sandbox-integration-key",
  ], {
    timeout: 20000,
    env: {
      ...process.env, NODE_ENV: "test", MONGODB_URI: "",
      RAZORPAY_SANDBOX_MONGODB_URI: uri, RAZORPAY_MODE: "test",
      RAZORPAY_KEY_ID: "rzp_test_fixture", RAZORPAY_KEY_SECRET: "fixture",
      TEST_GST_RATE_BPS: "500", TEST_GATEWAY_RATE_BPS: "200", ...overrides,
    },
  });
  await assert.rejects(run(database, { NODE_ENV: "production" }), /development environment/);
  await assert.rejects(run(database, { MONGODB_URI: uri }), /separate test database/);
  await assert.rejects(run("unconfirmed_database"), /does not match --test-database/);
  assert.deepEqual((await connection.listCollections()).map(collection => collection.name), ["users"]);

  async function order() {
    const { stdout } = await run(database);
    return JSON.parse(stdout.slice(stdout.indexOf("{")));
  }
  const prepared = await order();
  assert.equal(prepared.providerOrderId, "order_Sandbox123");
  assert.equal(prepared.amountPaise, 13929);
  assert.equal(prepared.gstPaise, 650);
  assert.equal(prepared.gatewayFeePaise, 279);
  assert.equal(prepared.authorSharePaise, 10000);
  assert.equal(prepared.platformSharePaise, 3000);
  assert.equal(prepared.referralSharePaise, 0);
  assert.deepEqual(await order(), prepared);
  assert.equal(await connection.collection(Order.collection.name).countDocuments(), 1);
  assert.equal(await connection.collection(Attempt.collection.name).countDocuments(), 1);
});

test("private storage verification requires a non-production test invocation", async () => {
  const script = fileURLToPath(new URL("../src/scripts/verifyPrivateStorage.js", import.meta.url));
  await assert.rejects(
    promisify(execFile)(process.execPath, [script, "--test-bucket"], {
      env: { ...process.env, NODE_ENV: "production" },
      timeout: 10000,
    }),
    error => error.code === 1 && error.stderr.includes("dedicated private test bucket"),
  );
});

test("direct purchase retains its itemized receipt and access after a duplicate refund", t => verifyPurchase(t, false));
test("referred purchase retains its itemized receipt and access after a duplicate refund", t => verifyPurchase(t, true));
