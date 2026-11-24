export function inrPriceToPaise(value, maximumRupees = 100000) {
  const text = typeof value === "number"
    ? (Number.isFinite(value) ? String(value) : "")
    : typeof value === "string"
      ? value.trim()
      : "";

  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  if (!Number.isSafeInteger(maximumRupees) || maximumRupees < 0) return null;

  const [rupees, fraction = ""] = text.split(".");
  const paise = BigInt(rupees) * 100n + BigInt(fraction.padEnd(2, "0"));
  const maximumPaise = BigInt(maximumRupees) * 100n;
  if (paise > maximumPaise || paise > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(paise);
}

export function inrPriceFromPaise(paise) {
  if (!Number.isSafeInteger(paise) || paise < 0) return null;
  return paise / 100;
}
