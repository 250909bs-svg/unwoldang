import { ReportRequestError } from '../../../src/lib/server/geminiReportService.ts';
import { API_ERROR_CODE, type ApiErrorCode, type ApiErrorResponse } from './api.ts';

export { ReportRequestError };

type PublicErrorOptions = {
  code?: ApiErrorCode;
  exposeMessage?: boolean;
};

export class PaymentRequestError extends Error {
  status: number;
  readonly code?: ApiErrorCode;
  readonly exposeMessage: boolean;

  constructor(status: number, message: string, options: PublicErrorOptions = {}) {
    super(message);
    this.name = 'PaymentRequestError';
    this.status = status;
    this.code = options.code;
    this.exposeMessage = options.exposeMessage ?? status < 500;
  }
}

export class ReportGenerationInProgressError extends ReportRequestError {
  readonly code = API_ERROR_CODE.REPORT_GENERATION_IN_PROGRESS;
  readonly exposeMessage = true;
  readonly retryAfterSeconds = 3;

  constructor() {
    super(409, 'Report generation is already in progress for this payment.');
    this.name = 'ReportGenerationInProgressError';
  }
}

export class ReportInputConflictError extends ReportRequestError {
  readonly code = API_ERROR_CODE.REPORT_INPUT_CONFLICT;
  readonly exposeMessage = true;

  constructor() {
    super(409, 'This payment has already been bound to a different report input.');
    this.name = 'ReportInputConflictError';
  }
}

export class KakaoAuthError extends Error {
  status: number;
  readonly code?: ApiErrorCode;
  readonly exposeMessage: boolean;

  constructor(status: number, message: string, options: PublicErrorOptions = {}) {
    super(message);
    this.name = 'KakaoAuthError';
    this.status = status;
    this.code = options.code;
    this.exposeMessage = options.exposeMessage ?? status < 500;
  }
}

export class DataStoreRequestError extends ReportRequestError {
  readonly code = API_ERROR_CODE.DATASTORE_UNAVAILABLE;
  readonly exposeMessage = false;
  readonly providerStatus: number;
  readonly providerMessage: string;

  constructor(providerStatus: number, providerMessage: string) {
    super(
      providerStatus === 404
        ? 404
        : providerStatus === 409 || providerStatus === 412
          ? providerStatus
          : 503,
      'Server data storage is temporarily unavailable.'
    );
    this.name = 'DataStoreRequestError';
    this.providerStatus = providerStatus;
    this.providerMessage = providerMessage;
  }
}

export type PublicApiErrorFallback = {
  code: ApiErrorCode;
  message: string;
};

function statusCode(status: number, fallback: ApiErrorCode): ApiErrorCode {
  if (status === 400 || status === 422) {
    return API_ERROR_CODE.REQUEST_INVALID;
  }
  if (status === 401) {
    return API_ERROR_CODE.AUTH_REQUIRED;
  }
  if (status === 403) {
    return API_ERROR_CODE.ACCESS_DENIED;
  }
  if (status === 404) {
    return API_ERROR_CODE.RESOURCE_NOT_FOUND;
  }
  if (status === 409 || status === 412) {
    return API_ERROR_CODE.STATE_CONFLICT;
  }
  if (status === 413) {
    return API_ERROR_CODE.PAYLOAD_TOO_LARGE;
  }
  if (status === 429) {
    return API_ERROR_CODE.RATE_LIMITED;
  }
  if (status === 502 || status === 503 || status === 504) {
    return API_ERROR_CODE.SERVICE_UNAVAILABLE;
  }
  return fallback;
}

function getStatus(error: unknown) {
  if (
    error instanceof PaymentRequestError ||
    error instanceof KakaoAuthError ||
    error instanceof ReportRequestError
  ) {
    return error.status;
  }
  return 500;
}

function mayExposeMessage(error: unknown, status: number) {
  if (error instanceof PaymentRequestError || error instanceof KakaoAuthError) {
    return error.exposeMessage;
  }
  if (error instanceof DataStoreRequestError) {
    return false;
  }
  if (error instanceof ReportGenerationInProgressError) {
    return true;
  }
  return error instanceof ReportRequestError && status < 500;
}

function explicitCode(error: unknown) {
  if (
    error instanceof PaymentRequestError ||
    error instanceof KakaoAuthError ||
    error instanceof DataStoreRequestError ||
    error instanceof ReportGenerationInProgressError ||
    error instanceof ReportInputConflictError
  ) {
    return error.code;
  }
  return undefined;
}

export function toPublicApiError(
  error: unknown,
  fallback: PublicApiErrorFallback
): { status: number; body: ApiErrorResponse } {
  const status = getStatus(error);
  const body: ApiErrorResponse = {
    code: explicitCode(error) || statusCode(status, fallback.code),
    message:
      mayExposeMessage(error, status) && error instanceof Error
        ? error.message
        : fallback.message
  };

  if (error instanceof ReportGenerationInProgressError) {
    body.retryAfterSeconds = error.retryAfterSeconds;
  }

  return { status, body };
}
