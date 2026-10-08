// utils/money.ts
const SYMBOLS: Record<string, string> = { INR: '₹' };

/**
 * Formats an amount exactly as it will be charged: whole rupees without
 * decimals ("₹1,250"), anything else with two ("₹1,249.50"). Never rounds a
 * fractional amount to a whole number.
 */
export function formatMoney(amount: number, currency = 'INR'): string {
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  const value = Number.isFinite(amount) ? amount : 0;
  const fixed = Number.isInteger(value) ? String(value) : value.toFixed(2);
  const [whole, fraction] = fixed.replace('-', '').split('.');

  // Indian grouping: last three digits, then groups of two (12,34,567).
  const lastThree = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${lastThree}` : lastThree;

  return `${value < 0 ? '−' : ''}${symbol}${grouped}${fraction ? `.${fraction}` : ''}`;
}
