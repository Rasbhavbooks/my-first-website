export function normalizeIsbn(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return "";
  const isbn = trimmed.replace(/[\s-]/g, "").toUpperCase();

  if (/^\d{13}$/.test(isbn)) {
    const sum = [...isbn.slice(0, 12)].reduce((total, digit, index) => (
      total + Number(digit) * (index % 2 === 0 ? 1 : 3)
    ), 0);
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === Number(isbn[12]) ? isbn : null;
  }

  if (/^\d{9}[\dX]$/.test(isbn)) {
    const sum = [...isbn.slice(0, 9)].reduce((total, digit, index) => (
      total + Number(digit) * (10 - index)
    ), 0);
    const checkValue = isbn[9] === "X" ? 10 : Number(isbn[9]);
    return (sum + checkValue) % 11 === 0 ? isbn : null;
  }

  return null;
}
