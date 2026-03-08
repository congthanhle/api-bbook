// src/common/interfaces/api-response.interface.ts

/**
 * Standard pagination metadata included in list responses.
 */
export interface PaginationMeta {
  /** Current page number (1-indexed) */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Total number of items across all pages */
  total: number;
  /** Total number of pages */
  totalPages: number;
}

/**
 * Standard API success response envelope.
 * All successful responses are wrapped in this format.
 */
export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
  meta?: PaginationMeta;
}

/**
 * Standard API error response envelope.
 * All error responses are wrapped in this format.
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string | number;
    message: string;
    details?: unknown;
  };
}
