export const STANDARD_API_ERROR_CODES = [
  'REQUEST_INVALID',
  'AUTH_REQUIRED',
  'ACCESS_DENIED',
  'RESOURCE_NOT_FOUND',
  'RATE_LIMIT_EXCEEDED',
  'REPORT_ACCESS_REQUIRED',
  'REPORT_GENERATION_IN_PROGRESS',
  'REPORT_GENERATION_FAILED',
  'PAYMENT_REQUEST_FAILED',
  'PAYMENT_CONFIRMATION_FAILED',
  'AUTH_PROVIDER_FAILED',
  'ARCHIVE_OPERATION_FAILED',
  'ADMIN_AUTH_FAILED',
  'SERVICE_NOT_READY',
  'INTERNAL_ERROR'
] as const;

export type StandardApiErrorCode = (typeof STANDARD_API_ERROR_CODES)[number];

export type LegacyPaymentApiErrorCode =
  | 'PAYMENT_API_ENDPOINT_INVALID'
  | 'PAYMENT_API_NETWORK_ERROR'
  | 'PAYMENT_API_HTTP_ERROR'
  | 'PAYMENT_API_RESPONSE_INVALID'
  | 'PAYMENT_API_CONTRACT_VIOLATION';

export type ApiErrorCode = StandardApiErrorCode | LegacyPaymentApiErrorCode;

export type ApiErrorOptions = {
  code: ApiErrorCode;
  userMessage: string;
  status?: number;
  requestId?: string;
  cause?: unknown;
};

/**
 * `message` intentionally mirrors `userMessage` for existing UI consumers.
 * Diagnostics should branch on `code`/`status` and must not expose `cause`.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly userMessage: string;
  readonly status?: number;
  readonly requestId?: string;
  readonly cause?: unknown;

  constructor({ code, userMessage, status, requestId, cause }: ApiErrorOptions) {
    super(userMessage);
    this.name = 'ApiError';
    this.code = code;
    this.userMessage = userMessage;
    this.status = status;
    this.requestId = requestId;
    this.cause = cause;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;
