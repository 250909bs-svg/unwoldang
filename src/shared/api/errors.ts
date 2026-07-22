export type ApiErrorCode =
  | 'PAYMENT_API_ENDPOINT_INVALID'
  | 'PAYMENT_API_NETWORK_ERROR'
  | 'PAYMENT_API_HTTP_ERROR'
  | 'PAYMENT_API_RESPONSE_INVALID'
  | 'PAYMENT_API_CONTRACT_VIOLATION';

type ApiErrorOptions = {
  code: ApiErrorCode;
  userMessage: string;
  status?: number;
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
  readonly cause?: unknown;

  constructor({ code, userMessage, status, cause }: ApiErrorOptions) {
    super(userMessage);
    this.name = 'ApiError';
    this.code = code;
    this.userMessage = userMessage;
    this.status = status;
    this.cause = cause;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;
