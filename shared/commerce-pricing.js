const DEFAULT_COMMISSION_RATE_BPS = 3000;
const DEFAULT_REFERRAL_RATE_BPS = 1000;
const RATE_DENOMINATOR = 10000n;
const MAX_GATEWAY_RATE_BPS = 5000;

function assertRate(name, rate, maximum = 10000) {
  if (!Number.isSafeInteger(rate) || rate < 0 || rate > maximum) {
    throw new RangeError(`${name} must be an integer basis-point rate from 0 to ${maximum}.`);
  }
}

function safePaise(name, value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative whole-paise amount.`);
  }
  return BigInt(value);
}

function roundBasisPoints(amountPaise, rateBps) {
  return Number((amountPaise * BigInt(rateBps) + RATE_DENOMINATOR / 2n) / RATE_DENOMINATOR);
}

/**
 * Test-mode eBook pricing. The GST fixture applies to author price plus platform
 * commission. Gateway fee is calculated on the final customer-paid total.
 * Live GST/invoice policy must be approved separately before checkout is enabled.
 */
export function calculateEbookQuote({
  authorPricePaise,
  gstRateBps = 500,
  gatewayRateBps = 200,
  referralValid = false,
} = {}) {
  const authorPrice = safePaise("authorPricePaise", authorPricePaise);
  assertRate("gstRateBps", gstRateBps);
  assertRate("gatewayRateBps", gatewayRateBps, MAX_GATEWAY_RATE_BPS);
  if (typeof referralValid !== "boolean") throw new TypeError("referralValid must be a boolean.");

  const commission = BigInt(roundBasisPoints(authorPrice, DEFAULT_COMMISSION_RATE_BPS));
  const referralReward = referralValid
    ? BigInt(roundBasisPoints(authorPrice, DEFAULT_REFERRAL_RATE_BPS))
    : 0n;
  const platformCommission = commission - referralReward;
  const taxableSubtotal = authorPrice + commission;
  const gst = BigInt(roundBasisPoints(taxableSubtotal, gstRateBps));
  const beforeGateway = taxableSubtotal + gst;

  let total = beforeGateway;
  let gatewayFee = 0n;
  // Solves total = pre-gateway price + round(total * gateway rate), in whole paise.
  for (let iteration = 0; iteration < 128; iteration += 1) {
    gatewayFee = BigInt(roundBasisPoints(total, gatewayRateBps));
    const nextTotal = beforeGateway + gatewayFee;
    if (nextTotal === total) break;
    total = nextTotal;
    if (iteration === 127) throw new RangeError("Gateway fee rate did not converge.");
  }

  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  const values = [commission, referralReward, platformCommission, taxableSubtotal, gst, gatewayFee, total];
  if (values.some((value) => value > maxSafe)) throw new RangeError("Calculated price exceeds the safe whole-paise range.");

  return Object.freeze({
    authorPricePaise: Number(authorPrice),
    commissionRateBps: DEFAULT_COMMISSION_RATE_BPS,
    commissionPaise: Number(commission),
    platformCommissionPaise: Number(platformCommission),
    referralRateBps: referralValid ? DEFAULT_REFERRAL_RATE_BPS : 0,
    referrerRewardPaise: Number(referralReward),
    taxableSubtotalPaise: Number(taxableSubtotal),
    gstRateBps,
    gstPaise: Number(gst),
    gatewayRateBps,
    gatewayFeePaise: Number(gatewayFee),
    totalPaise: Number(total),
  });
}

export function buildSaleLedgerEntries(quote) {
  const entries = [
    { accountCode: "gateway_clearing", direction: "debit", amountPaise: quote.totalPaise },
    { accountCode: "author_payable", direction: "credit", amountPaise: quote.authorPricePaise },
    { accountCode: "platform_commission", direction: "credit", amountPaise: quote.platformCommissionPaise },
    { accountCode: "tax_payable", direction: "credit", amountPaise: quote.gstPaise },
    { accountCode: "gateway_fee_payable", direction: "credit", amountPaise: quote.gatewayFeePaise },
  ];
  if (quote.referrerRewardPaise > 0) {
    entries.push({ accountCode: "referrer_payable", direction: "credit", amountPaise: quote.referrerRewardPaise });
  }
  return entries.filter((entry) => entry.amountPaise > 0);
}

export function buildFullRefundLedgerEntries(quote) {
  const entries = [
    { accountCode: "gateway_clearing", direction: "credit", amountPaise: quote.totalPaise },
    { accountCode: "author_payable", direction: "debit", amountPaise: quote.authorPricePaise },
    { accountCode: "platform_commission", direction: "debit", amountPaise: quote.platformCommissionPaise },
    { accountCode: "tax_payable", direction: "debit", amountPaise: quote.gstPaise },
    // A fully refunded book may still incur the original gateway fee.
    { accountCode: "gateway_fee_expense", direction: "debit", amountPaise: quote.gatewayFeePaise },
  ];
  if (quote.referrerRewardPaise > 0) {
    entries.push({ accountCode: "referrer_payable", direction: "debit", amountPaise: quote.referrerRewardPaise });
  }
  return entries.filter((entry) => entry.amountPaise > 0);
}
