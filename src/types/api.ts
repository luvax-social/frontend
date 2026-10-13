export interface ApiResponse<T> {
  success: boolean;
  code: string;
  message: string;
  data: T;
  timestamp: string;
}

export interface ErrorPayload {
  code?: string;
  message?: string;
  error?: string;
  detail?: string;
  errors?: { message?: string }[];
  data?: Record<string, unknown> | null;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface CursorParams extends RequestOptions {
  cursor?: string | null;
  limit?: number;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

export interface CursorPage<T> {
  content: T[];
  pageInfo: PageInfo;
  degraded: boolean;
}

export interface OffsetPage<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}
