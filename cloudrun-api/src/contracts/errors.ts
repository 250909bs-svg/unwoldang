import { ReportRequestError } from '../../../src/lib/server/geminiReportService.ts';
import type { ReportErrorCode } from '../../../src/features/reports/contracts.ts';

export { ReportRequestError };

export const REPORT_ERROR_CODE = Object.freeze({
  INVALID_REQUEST: 'REPORT_REQUEST_INVALID',
  ACCESS_REQUIRED: 'REPORT_AUTH_REQUIRED',
  ACCESS_MISMATCH: 'REPORT_ENTITLEMENT_INVALID',
  ENTITLEMENT_INPUT_CONFLICT: 'REPORT_INPUT_CONFLICT',
  GENERATION_IN_PROGRESS: 'REPORT_GENERATION_IN_PROGRESS',
  LEASE_INVALID: 'REPORT_LEASE_INVALID',
  LEASE_LOST: 'REPORT_LEASE_LOST',
  CACHE_INVALID: 'REPORT_CACHE_INTEGRITY_FAILED',
  RESPONSE_INVALID: 'REPORT_RESPONSE_INVALID',
  STORAGE_UNAVAILABLE: 'REPORT_STORAGE_UNAVAILABLE',
  FACT_GUARD_REJECTED: 'REPORT_FACT_GUARD_REJECTED',
  DEGRADED_FALLBACK: 'REPORT_DEGRADED_FALLBACK',
  GENERATION_FAILED: 'REPORT_UNKNOWN_ERROR'
} as const satisfies Record<string, ReportErrorCode>);

export class ReportPlatformError extends ReportRequestError {
  readonly code: ReportErrorCode;
  readonly retryable: boolean;
  readonly retryAfterSeconds?: number;
  readonly cause?: unknown;

  constructor(input: {
    status: number;
    code: ReportErrorCode;
    message: string;
    retryable?: boolean;
    retryAfterSeconds?: number;
    cause?: unknown;
  }) {
    super(input.status, input.message);
    this.name = 'ReportPlatformError';
    this.code = input.code;
    this.retryable = Boolean(input.retryable);
    this.retryAfterSeconds = input.retryAfterSeconds;
    this.cause = input.cause;
  }
}

export class PaymentRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'PaymentRequestError';
    this.status = status;
  }
}

export class ReportGenerationInProgressError extends ReportPlatformError {
  declare readonly retryAfterSeconds: number;

  constructor() {
    super({
      status: 409,
      code: REPORT_ERROR_CODE.GENERATION_IN_PROGRESS,
      message: 'Report generation is already in progress for this payment.',
      retryable: true,
      retryAfterSeconds: 3
    });
    this.name = 'ReportGenerationInProgressError';
  }
}

export class KakaoAuthError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'KakaoAuthError';
    this.status = status;
  }
}
