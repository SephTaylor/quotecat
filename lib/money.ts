// lib/money.ts
export function formatMoney(n: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
  } catch {
    // Fallback if the device doesn't have the currency
    const amount = Number.isFinite(n) ? n : 0;
    return `${currency} ${amount.toFixed(2)}`;
  }
}
