import assert from "node:assert/strict";
import test from "node:test";
import { createRefundSubmissionService } from "./refund-submission.service.js";

const requestId = "507f1f77bcf86cd799439011";

function makeRequest(overrides = {}) {
  const calls = [];
  const request = {
    _id: requestId,
    reason: "duplicate_payment",
    providerPaymentId: "pay_duplicate",
    amountPaise: 13929,
    currency: "INR",
    status: "pending",
    providerRefundId: "",
    transitionTo(status, { now = new Date(), providerRefundId } = {}) {
      calls.push(["transition", status, providerRefundId]);
      this.status = status;
      if (status === "completed") {
        this.providerRefundId = providerRefundId;
        this.completedAt = now;
      }
    },
    async save() { calls.push(["save", this.status]); },
    ...overrides,
  };
  return { request, calls };
}

test("submits a duplicate payment refund in test mode using stable idempotency", async () => {
  const { request, calls } = makeRequest();
  const providerCalls = [];
  const outcomes = [
    { status: "pending" },
    { status: "completed", refundId: "rfnd_test_1" },
  ];
  const service = createRefundSubmissionService({
    mode: "test",
    findRefundRequestById: async () => request,
    refundCapturedPayment: async (payload) => {
      providerCalls.push(payload);
      return outcomes.shift();
    },
  });
  assert.deepEqual(await service(requestId), { completed: false, replayed: false, status: "submitted" });
  assert.equal(request.status, "submitted");
  assert.deepEqual(await service(requestId), { completed: true, replayed: false, amountPaise: 13929 });
  assert.equal(request.status, "completed");
  assert.equal(request.providerRefundId, "rfnd_test_1");
  assert.deepEqual(providerCalls[0], providerCalls[1]);
  assert.equal(providerCalls[0].paymentId, "pay_duplicate");
  assert.equal(providerCalls[0].amountPaise, 13929);
  assert.match(providerCalls[0].idempotencyKey, /^[a-f0-9]{64}$/);
  assert.equal(calls.filter(([name, status]) => name === "save" && status === "submitted").length, 1);
});

test("completed refund retries do not call the provider again", async () => {
  const { request } = makeRequest({ status: "completed" });
  let providerCalls = 0;
  const service = createRefundSubmissionService({
    mode: "test",
    findRefundRequestById: async () => request,
    refundCapturedPayment: async () => { providerCalls += 1; },
  });
  assert.deepEqual(await service(requestId), { completed: true, replayed: true });
  assert.equal(providerCalls, 0);
});

test("refund submission fails closed outside test mode and for unsupported requests", async () => {
  assert.throws(() => createRefundSubmissionService({
    mode: "live",
    findRefundRequestById: async () => null,
    refundCapturedPayment: async () => null,
  }), { code: "LIVE_REFUNDS_DISABLED" });

  const { request } = makeRequest({ reason: "full_refund" });
  const service = createRefundSubmissionService({
    mode: "test",
    findRefundRequestById: async () => request,
    refundCapturedPayment: async () => null,
  });
  await assert.rejects(service(requestId), { code: "UNSUPPORTED_REFUND_REASON" });
});
