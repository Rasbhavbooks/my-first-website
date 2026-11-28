import { env } from "../../config/env.js";

function fail(message, code = "RAZORPAY_API_ERROR") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function validateOrderInput({ amountPaise, currency, receipt }) {
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 1) {
    throw fail("Razorpay order amount must be a positive whole-paise value.", "INVALID_RAZORPAY_ORDER");
  }
  if (currency !== "INR") {
    throw fail("Only INR Razorpay orders are supported.", "INVALID_RAZORPAY_ORDER");
  }
  if (typeof receipt !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(receipt)) {
    throw fail("Razorpay receipt must be a unique ASCII reference up to 40 characters.", "INVALID_RAZORPAY_ORDER");
  }
}

function validateProviderOrder(order, expected) {
  if (
    !order
    || !/^order_[A-Za-z0-9]{1,150}$/.test(String(order.id ?? ""))
    || order.amount !== expected.amountPaise
    || order.currency !== expected.currency
    || order.receipt !== expected.receipt
  ) {
    throw fail("Razorpay returned an order that does not match the local amount and receipt.", "RAZORPAY_ORDER_MISMATCH");
  }
  return { id: order.id, amountPaise: order.amount, currency: order.currency, receipt: order.receipt };
}

function validateProviderRefund(refund, { paymentId, amountPaise, currency, receipt }) {
  if (
    !refund || refund.entity !== "refund"
    || !/^rfnd_[A-Za-z0-9]{1,150}$/.test(String(refund.id ?? ""))
    || refund.payment_id !== paymentId || refund.amount !== amountPaise
    || refund.currency !== currency || refund.receipt !== receipt
    || !["pending", "processed", "failed"].includes(refund.status)
  ) {
    throw fail("Razorpay returned a refund that does not match the request.", "RAZORPAY_REFUND_MISMATCH");
  }
  return refund;
}

export function createRazorpayClient({
  keyId,
  keySecret,
  fetchImpl = globalThis.fetch,
  apiBaseUrl = "https://api.razorpay.com/v1",
}) {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("Razorpay client requires fetch.");
  }

  function getAuthorization() {
    if (!keyId || !keySecret || !String(keyId).startsWith("rzp_test_")) {
      throw fail("Razorpay test API credentials are not configured.", "PAYMENT_PROVIDER_NOT_CONFIGURED");
    }
    return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
  }

  async function request(path, options) {
    const authorization = getAuthorization();
    let response;
    try {
      response = await fetchImpl(`${apiBaseUrl}${path}`, {
        ...options,
        headers: {
          "content-type": "application/json",
          ...options.headers,
          authorization,
        },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw fail("Razorpay could not be reached.", "RAZORPAY_UNAVAILABLE");
    }

    let body;
    try {
      body = await response.json();
    } catch {
      throw fail("Razorpay returned an unreadable response.", "RAZORPAY_INVALID_RESPONSE");
    }
    if (!response.ok) {
      throw fail("Razorpay rejected the test-mode request.", "RAZORPAY_API_REJECTED");
    }
    return body;
  }

  return {
    async refundCapturedPayment({ paymentId, amountPaise, currency, idempotencyKey }) {
      if (
        typeof paymentId !== "string" || !/^pay_[A-Za-z0-9]{1,150}$/.test(paymentId)
        || !Number.isSafeInteger(amountPaise) || amountPaise < 100 || currency !== "INR"
        || typeof idempotencyKey !== "string" || !/^[a-f0-9]{64}$/.test(idempotencyKey)
      ) {
        throw fail("A valid INR payment, amount and refund key are required.", "INVALID_RAZORPAY_REFUND");
      }
      const receipt = "rb-" + idempotencyKey.slice(0, 36);
      const expected = { paymentId, amountPaise, currency, receipt };
      const paymentPath = `/payments/${paymentId}`;
      let refund = validateProviderRefund(await request(paymentPath + "/refund", {
        method: "POST",
        headers: { "X-Refund-Idempotency": idempotencyKey },
        body: JSON.stringify({ amount: amountPaise, speed: "normal", receipt }),
      }), expected);
      // The idempotent POST can replay its initial pending response.
      if (refund.status === "pending") {
        const refundId = refund.id;
        refund = validateProviderRefund(await request(paymentPath + "/refunds/" + refundId, { method: "GET" }), expected);
        if (refund.id !== refundId) throw fail("Razorpay returned a different refund ID.", "RAZORPAY_REFUND_MISMATCH");
      }
      if (refund.status === "failed") {
        throw fail("Razorpay marked the test refund as failed.", "RAZORPAY_REFUND_FAILED");
      }
      return { status: refund.status === "processed" ? "completed" : "pending", refundId: refund.id, paymentId, amountPaise, currency };
    },

    async checkConnection() {
      const body = await request("/orders?count=1", { method: "GET" });
      if (!Array.isArray(body?.items)) {
        throw fail("Razorpay returned an unexpected connection-check response.", "RAZORPAY_INVALID_RESPONSE");
      }
      return true;
    },

    async createOrder(input) {
      validateOrderInput(input);
      const body = await request("/orders", {
        method: "POST",
        body: JSON.stringify({
          amount: input.amountPaise,
          currency: input.currency,
          receipt: input.receipt,
          notes: input.notes,
        }),
      });
      return validateProviderOrder(body, input);
    },

    async findOrderByReceipt(input) {
      validateOrderInput(input);
      const query = new URLSearchParams({ receipt: input.receipt, count: "2" });
      const body = await request(`/orders?${query.toString()}`, { method: "GET" });
      const matches = Array.isArray(body?.items)
        ? body.items.filter((item) => item?.receipt === input.receipt)
        : [];
      if (matches.length > 1) {
        throw fail("Razorpay returned multiple orders for one receipt.", "RAZORPAY_ORDER_MISMATCH");
      }
      return matches.length === 1 ? validateProviderOrder(matches[0], input) : null;
    },
  };
}

const defaultClient = createRazorpayClient({
  keyId: env.razorpayKeyId,
  keySecret: env.razorpayKeySecret,
});

export default defaultClient;
