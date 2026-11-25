export function cataloguePriceFilter(priceType) {
  if (priceType === "all") return {};
  if (priceType === "free") return { price: 0 };
  if (priceType === "paid") return { price: { $gt: 0 } };
  return null;
}
