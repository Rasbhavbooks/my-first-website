const PRICE_LOCALES = { en: "en-IN", gu: "gu-IN", hi: "hi-IN" };

export function formatInr(value, language = "en") {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return "—";
  const locale = PRICE_LOCALES[language] || PRICE_LOCALES.en;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}
