// src/common/utils/pagination.helper.ts

import { PaginationMeta, PaginationQuery } from '../interfaces';

/** Default page size */
const DEFAULT_LIMIT = 10;

/** Maximum allowed page size */
const MAX_LIMIT = 100;

/**
 * Normalises raw pagination query parameters into safe values.
 *
 * @param query - Raw pagination query from the request
 * @returns Normalised `{ page, limit, offset }` values
 */
export function normalisePagination(query: PaginationQuery): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Builds a `PaginationMeta` object from the total count and pagination params.
 *
 * @param total - Total number of items in the result set
 * @param page - Current page number (1-indexed)
 * @param limit - Items per page
 * @returns PaginationMeta for the API response envelope
 *
 * @example
 * ```ts
 * const meta = buildPaginationMeta(100, 2, 10);
 * // { page: 2, limit: 10, total: 100, totalPages: 10 }
 * ```
 */
export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}
