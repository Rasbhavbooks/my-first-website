import assert from "node:assert/strict";
import test from "node:test";
import { createPaymentEventRecorder } from "./payment-event-recorder.js";

const eventId = "event-captured-1";
const orderId = "507f1f77bcf86cd799439011";
const paymentAttemptId = "507f1f77bcf86cd799439012";
const rawBody = Buffer.from("{\"id\":\"event-captured-1\"}");
const headers = { "x-example-signature": "verified-by-adapter" };
const verifiedFacts = {
  signatureVerified: true,
  signatureVerifiedAt: new Date("2026-11-25T10:00:00.000Z"),
  provider: "Example-Gateway",
  eventId,
  eventType: "payment.captured",
  providerPaymentId: "payment-123",
  providerOrderId: "order_test123",
  paymentAttemptId,
  orderId,
  amountPaise: 4900,
  currency: "inr",
};

function recorder({ facts = verifiedFacts, existing = null, duplicateCreate = false } = {}) {
  const calls = [];
  const event = {
    ...facts,
    provider: "example-gateway",
    eventType: facts.eventType.toLowerCase(),
    currency: "INR",
    outcome: facts.eventType.toLowerCase() === "payment.captured" ? "applied" : "ignored",
  };
  return {
    calls,
    service: createPaymentEventRecorder({
      verifyAndNormalize: async (input) => {
        calls.push(["verify", input]);
        return facts;
      },
      findByProviderEventId: async (provider, id, options) => {
        calls.push(["find", provider, id, options]);
        return existing;
      },
      createRecord: async (data, options) => {
        calls.push(["create", data, options]);
        if (duplicateCreate) {
          const error = new Error("duplicate");
          error.code = 11000;
          throw error;
        }
        return { ...event, ...data };
      },
    }),
  };
}

test("verifies original bytes before saving normalized facts and does not persist raw body", async () => {
  const data = recorder();
  const result = await data.service({ rawBody, headers });
  assert.equal(result.replayed, false);
  assert.equal(result.event.outcome, "applied");
  assert.equal(result.event.provider, "example-gateway");
  assert.deepEqual(data.calls.map(([name]) => name), ["verify", "find", "create"]);
  assert.equal(data.calls[0][1].rawBody, rawBody);
  assert.equal(Object.hasOwn(data.calls[2][1], "rawBody"), false);
  assert.equal(Object.hasOwn(data.calls[2][1], "signatureVerified"), false);
});

test("rejects before lookup or persistence when verification fails", async () => {
  const data = recorder({ facts: { ...verifiedFacts, signatureVerified: false } });
  await assert.rejects(data.service({ rawBody, headers }), { code: "SIGNATURE_VERIFICATION_FAILED" });
  assert.deepEqual(data.calls.map(([name]) => name), ["verify"]);
});

test("validates raw webhook size and shape before invoking the verifier", async (t) => {
  for (const [label, input] of [
    ["missing bytes", { rawBody: Buffer.alloc(0), headers }],
    ["oversized bytes", { rawBody: Buffer.alloc(256 * 1024 + 1), headers }],
    ["missing signature headers", { rawBody, headers: null }],
  ]) {
    await t.test(label, async () => {
      const data = recorder();
      await assert.rejects(data.service(input));
      assert.equal(data.calls.length, 0);
    });
  }
});

test("only captured events receive the applied outcome", async () => {
  const data = recorder({ facts: { ...verifiedFacts, eventType: "payment.failed" } });
  const result = await data.service({ rawBody, headers });
  assert.equal(result.event.outcome, "ignored");
});

test("returns a replay for matching signed event facts but rejects reused event IDs", async (t) => {
  const matching = {
    ...verifiedFacts,
    provider: "example-gateway",
    currency: "INR",
    eventType: "payment.captured",
    outcome: "applied",
  };
  await t.test("matching replay", async () => {
    const data = recorder({ existing: matching });
    const result = await data.service({ rawBody, headers });
    assert.equal(result.replayed, true);
    assert.equal(data.calls.some(([name]) => name === "create"), false);
  });
  await t.test("conflicting amount", async () => {
    const data = recorder({ existing: { ...matching, amountPaise: 5000 } });
    await assert.rejects(data.service({ rawBody, headers }), { code: "EVENT_ID_REUSED" });
  });
});

test("duplicate insert race is re-read and treated idempotently only for matching facts", async () => {
  const matching = {
    ...verifiedFacts,
    provider: "example-gateway",
    currency: "INR",
    eventType: "payment.captured",
    outcome: "applied",
  };
  const data = recorder({ duplicateCreate: true, existing: matching });
  const result = await data.service({ rawBody, headers });
  assert.equal(result.replayed, true);
});

test("rejects non-INR, fractional paise, malformed order, and unsigned timestamps", async (t) => {
  const cases = [
    ["non-INR", { currency: "USD" }],
    ["fractional paise", { amountPaise: 49.5 }],
    ["invalid order", { orderId: "not-an-object-id" }],
    ["invalid attempt", { paymentAttemptId: "not-an-object-id" }],
    ["missing provider order", { providerOrderId: "" }],
    ["missing verification time", { signatureVerifiedAt: null }],
  ];
  for (const [label, facts] of cases) {
    await t.test(label, async () => {
      const data = recorder({ facts: { ...verifiedFacts, ...facts } });
      await assert.rejects(data.service({ rawBody, headers }));
      assert.equal(data.calls.some(([name]) => name === "create"), false);
    });
  }
});
