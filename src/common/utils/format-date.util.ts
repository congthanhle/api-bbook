// src/common/utils/format-date.util.ts

/**
 * Formats a Date object into a human-readable string.
 *
 * @param date - The date to format
 * @param locale - The locale string (default: 'vi-VN')
 * @returns Formatted date string, e.g. '07/03/2026'
 *
 * @example
 * ```ts
 * formatDate(new Date('2026-03-07')); // '07/03/2026'
 * formatDate(new Date(), 'en-US');     // '3/7/2026'
 * ```
 */
export function formatDate(date: Date, locale = 'vi-VN'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Formats a Date object into a date + time string.
 *
 * @param date - The date to format
 * @param locale - The locale string (default: 'vi-VN')
 * @returns Formatted datetime string, e.g. '07/03/2026, 14:30'
 */
export function formatDateTime(date: Date, locale = 'vi-VN'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Formats a Date object into an ISO date string (YYYY-MM-DD).
 *
 * @param date - The date to format
 * @returns ISO date string, e.g. '2026-03-07'
 */
export function toISODateString(date: Date): string {
  return date.toISOString().split('T')[0];
}
