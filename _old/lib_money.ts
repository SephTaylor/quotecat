// lib/money.ts
export function formatMoney(
  value: unknown,
  currency: string = "USD",
  locale?: string,
) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  const cur = (currency || "USD").toUpperCase();

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    const sign = safe < 0 ? "-" : "";
    const abs = Math.abs(safe).toFixed(2);
    const symbol = cur === "USD" ? "$" : cur === "CRC" ? "₡" : cur + " ";
    return `${sign}${symbol}${abs}`;
  }
}
