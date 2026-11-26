import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFullRefundLedgerEntries,
  buildSaleLedgerEntries,
  calculateEbookQuote,
  planDuplicatePaymentRefund,
  planFullRefund,
} from "../../../../shared/commerce-pricing.js";

const direct = { authorPricePaise: 10000, gstRateBps: 500, gatewayRateBps: 200 };
const referral = { ...direct, referralValid: true };

test("₹100 direct sale adds a 30% platform commission before GST and gateway fee", () => {
  const quote = calculateEbookQuote(direct);
  assert.deepEqual(quote, {
    authorPricePaise: 10000,
    commissionRateBps: 3000,
    commissionPaise: 3000,
    platformCommissionPaise: 3000,
    referralRateBps: 0,
    referrerRewardPaise: 0,
    taxableSubtotalPaise: 13000,
    gstRateBps: 500,
    gstPaise: 650,
    gatewayRateBps: 200,
    gatewayFeePaise: 279,
    totalPaise: 13929,
  });
  const saleEntries = buildSaleLedgerEntries(quote);
  assert.equal(saleEntries.find((entry) => entry.accountCode === "author_payable").amountPaise, 10000);
  assert.equal(saleEntries.find((entry) => entry.accountCode === "platform_commission").amountPaise, 3000);
});

test("₹100 valid referral leaves customer price unchanged and assigns 10% of author price to the reader", () => {
  const quote = calculateEbookQuote(referral);
  assert.equal(quote.totalPaise, 13929);
  assert.equal(quote.authorPricePaise, 10000);
  assert.equal(quote.platformCommissionPaise, 2000);
  assert.equal(quote.referrerRewardPaise, 1000);
  assert.equal(quote.gstPaise, 650);
  assert.equal(quote.gatewayFeePaise, 279);

  const entries = buildSaleLedgerEntries(quote);
  assert.equal(entries.find((entry) => entry.accountCode === "author_payable").amountPaise, 10000);
  assert.equal(entries.find((entry) => entry.accountCode === "platform_commission").amountPaise, 2000);
  assert.equal(entries.find((entry) => entry.accountCode === "referrer_payable").amountPaise, 1000);
  const credits = entries.filter((entry) => entry.direction === "credit")
    .reduce((sum, entry) => sum + entry.amountPaise, 0);
  assert.equal(credits, quote.totalPaise);
});

test("full refund reverses author, platform, referral and tax allocations", () => {
  const quote = calculateEbookQuote(referral);
  const entries = buildFullRefundLedgerEntries(quote);
  assert.equal(entries.find((entry) => entry.accountCode === "gateway_clearing").amountPaise, 13929);
  assert.equal(entries.find((entry) => entry.accountCode === "author_payable").amountPaise, 10000);
  assert.equal(entries.find((entry) => entry.accountCode === "platform_commission").amountPaise, 2000);
  assert.equal(entries.find((entry) => entry.accountCode === "referrer_payable").amountPaise, 1000);
  assert.equal(entries.find((entry) => entry.accountCode === "tax_payable").amountPaise, 650);
  assert.equal(entries.find((entry) => entry.accountCode === "gateway_fee_expense").amountPaise, 279);
  assert.equal(entries.filter((entry) => entry.direction === "debit")
    .reduce((sum, entry) => sum + entry.amountPaise, 0), 13929);
});

test("prices and rates reject invalid paise values and rates", () => {
  assert.throws(() => calculateEbookQuote({ authorPricePaise: -1 }));
  assert.throws(() => calculateEbookQuote({ authorPricePaise: 10000.5 }));
  assert.throws(() => calculateEbookQuote({ authorPricePaise: 10000, gstRateBps: 10001 }));
  assert.throws(() => calculateEbookQuote({ authorPricePaise: 10000, gatewayRateBps: 5001 }));
});


test("a duplicate captured payment refunds only the second charge and retains the original purchase", () => {
  const quote = calculateEbookQuote(direct);
  const plan = planDuplicatePaymentRefund({
    orderAmountPaise: quote.totalPaise,
    originalCapturePaise: quote.totalPaise,
    duplicateCapturePaise: quote.totalPaise,
  });
  assert.equal(plan.refundAmountPaise, 13929);
  assert.equal(plan.retainedPaymentPaise, 13929);
  assert.equal(plan.orderStatus, "paid");
  assert.equal(plan.entitlement, "active");
  assert.throws(() => planDuplicatePaymentRefund({
    orderAmountPaise: 13929, originalCapturePaise: 13929, duplicateCapturePaise: 10000,
  }));
});

test("a confirmed full refund reverses allocation and revokes access", () => {
  const quote = calculateEbookQuote(referral);
  const plan = planFullRefund(quote);
  assert.equal(plan.refundAmountPaise, 13929);
  assert.equal(plan.orderStatus, "refunded");
  assert.equal(plan.entitlement, "revoked");
  assert.equal(plan.authorPayableReversalPaise, 10000);
  assert.equal(plan.platformCommissionReversalPaise, 2000);
  assert.equal(plan.referralRewardReversalPaise, 1000);
  assert.equal(plan.gstReversalPaise, 650);
  assert.equal(plan.gatewayFeeExpensePaise, 279);
  assert.equal(plan.ledgerEntries.filter((entry) => entry.direction === "debit")
    .reduce((total, entry) => total + entry.amountPaise, 0), 13929);
});
