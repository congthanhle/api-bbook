// src/common/interfaces/pagination.interface.ts

/**
 * Pagination query parameters accepted by list endpoints.
 */
export interface PaginationQuery {
  /** Page number (default: 1) */
  page?: number;
  /** Items per page (default: 10) */
  limit?: number;
  /** Sort field */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated result returned from service methods.
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
