// src/common/utils/format-currency.util.ts

/**
 * Formats a numeric value as Vietnamese Dong (VND) currency string.
 *
 * @param amount - The numeric amount to format
 * @param locale - The locale string (default: 'vi-VN')
 * @param currency - The currency code (default: 'VND')
 * @returns Formatted currency string, e.g. '150.000 ₫'
 *
 * @example
 * ```ts
 * formatCurrency(150000); // '150.000 ₫'
 * formatCurrency(99.99, 'en-US', 'USD'); // '$99.99'
 * ```
 */
export function formatCurrency(
  amount: number,
  locale = 'vi-VN',
  currency = 'VND',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
