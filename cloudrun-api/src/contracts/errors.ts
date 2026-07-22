import { ReportRequestError } from '../../../src/lib/server/geminiReportService.ts';

export { ReportRequestError };
export const PUBLIC_ERROR_CODES = Object.freeze({
  REQUEST_INVALID: 'REQUEST_INVALID',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  ACCESS_DENIED: 'ACCESS_DENIED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  REPORT_ACCESS_REQUIRED: 'REPORT_ACCESS_REQUIRED',
  REPORT_GENERATION_IN_PROGRESS: 'REPORT_GENERATION_IN_PROGRESS',
  REPORT_GENERATION_FAILED: 'REPORT_GENERATION_FAILED',
  PAYMENT_REQUEST_FAILED: 'PAYMENT_REQUEST_FAILED',
  PAYMENT_CONFIRMATION_FAILED: 'PAYMENT_CONFIRMATION_FAILED',
  AUTH_PROVIDER_FAILED: 'AUTH_PROVIDER_FAILED',
  ARCHIVE_OPERATION_FAILED: 'ARCHIVE_OPERATION_FAILED',
  ADMIN_AUTH_FAILED: 'ADMIN_AUTH_FAILED',
  SERVICE_NOT_READY: 'SERVICE_NOT_READY',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const);

export type PublicErrorCode = (typeof PUBLIC_ERROR_CODES)[keyof typeof PUBLIC_ERROR_CODES];
export type ErrorDomain =
  | 'report'
  | 'payment'
  | 'payment-confirmation'
  | 'auth'
  | 'archive'
  | 'archive-storage'
  | 'admin'
  | 'generic';

export const PUBLIC_ERROR_MESSAGES: Readonly<Record<PublicErrorCode, string>> = Object.freeze({
  REQUEST_INVALID: '입력 정보를 확인한 뒤 다시 시도해 주세요.',
  AUTH_REQUIRED: '로그인 후 다시 시도해 주세요.',
  ACCESS_DENIED: '이 요청을 처리할 권한이 없습니다.',
  RESOURCE_NOT_FOUND: '요청한 정보를 찾을 수 없습니다.',
  RATE_LIMIT_EXCEEDED: '요청이 많습니다. 잠시 후 다시 시도해 주세요.',
  REPORT_ACCESS_REQUIRED: '결제 리포트 접근 권한을 확인할 수 없습니다.',
  REPORT_GENERATION_IN_PROGRESS: '리포트를 생성하고 있습니다. 잠시 후 다시 확인해 주세요.',
  REPORT_GENERATION_FAILED: '리포트 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  PAYMENT_REQUEST_FAILED: '결제 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  PAYMENT_CONFIRMATION_FAILED: '결제 확인에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  AUTH_PROVIDER_FAILED: '로그인 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  ARCHIVE_OPERATION_FAILED: '리포트 보관함 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  ADMIN_AUTH_FAILED: '관리자 인증에 실패했습니다.',
  SERVICE_NOT_READY: '서비스 준비가 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.',
  INTERNAL_ERROR: '요청 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'
});

export type NormalizedPublicError = {
  status: number;
  errorCode: PublicErrorCode;
  message: string;
  retryAfterSeconds?: number;
};

function statusOf(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
  ) {
    const status = (error as { status: number }).status;
    return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
  }

  return 500;
}

function codeOf(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(PUBLIC_ERROR_MESSAGES, code)
    ? (code as PublicErrorCode)
    : undefined;
}

function retryAfterOf(error: unknown) {
  if (!error || typeof error !== 'object' || !('retryAfterSeconds' in error)) return undefined;
  const value = (error as { retryAfterSeconds?: unknown }).retryAfterSeconds;
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.ceil(value)
    : undefined;
}

function domainFailureCode(domain: ErrorDomain): PublicErrorCode {
  if (domain === 'report') return PUBLIC_ERROR_CODES.REPORT_GENERATION_FAILED;
  if (domain === 'payment-confirmation') return PUBLIC_ERROR_CODES.PAYMENT_CONFIRMATION_FAILED;
  if (domain === 'payment') return PUBLIC_ERROR_CODES.PAYMENT_REQUEST_FAILED;
  if (domain === 'auth') return PUBLIC_ERROR_CODES.AUTH_PROVIDER_FAILED;
  if (domain === 'archive' || domain === 'archive-storage') {
    return PUBLIC_ERROR_CODES.ARCHIVE_OPERATION_FAILED;
  }
  if (domain === 'admin') return PUBLIC_ERROR_CODES.ADMIN_AUTH_FAILED;
  return PUBLIC_ERROR_CODES.INTERNAL_ERROR;
}

/** Maps internal and provider failures to a stable, non-sensitive public contract. */
export function normalizePublicError(error: unknown, domain: ErrorDomain): NormalizedPublicError {
  const status = statusOf(error);
  const explicitCode = codeOf(error);
  let errorCode: PublicErrorCode;

  if (explicitCode) {
    errorCode = explicitCode;
  } else if (status === 400 || status === 413 || status === 422) {
    errorCode = PUBLIC_ERROR_CODES.REQUEST_INVALID;
  } else if (status === 401) {
    errorCode =
      domain === 'report'
        ? PUBLIC_ERROR_CODES.REPORT_ACCESS_REQUIRED
        : domain === 'payment'
          ? PUBLIC_ERROR_CODES.PAYMENT_REQUEST_FAILED
          : domain === 'payment-confirmation'
            ? PUBLIC_ERROR_CODES.PAYMENT_CONFIRMATION_FAILED
            : domain === 'auth'
              ? PUBLIC_ERROR_CODES.AUTH_PROVIDER_FAILED
              : domain === 'archive-storage'
                ? PUBLIC_ERROR_CODES.ARCHIVE_OPERATION_FAILED
              : domain === 'admin'
                ? PUBLIC_ERROR_CODES.ADMIN_AUTH_FAILED
                : PUBLIC_ERROR_CODES.AUTH_REQUIRED;
  } else if (status === 403) {
    errorCode =
      domain === 'payment'
        ? PUBLIC_ERROR_CODES.PAYMENT_REQUEST_FAILED
        : domain === 'payment-confirmation'
          ? PUBLIC_ERROR_CODES.PAYMENT_CONFIRMATION_FAILED
          : domain === 'auth'
            ? PUBLIC_ERROR_CODES.AUTH_PROVIDER_FAILED
            : domain === 'archive-storage'
              ? PUBLIC_ERROR_CODES.ARCHIVE_OPERATION_FAILED
            : domain === 'admin'
              ? PUBLIC_ERROR_CODES.ADMIN_AUTH_FAILED
              : PUBLIC_ERROR_CODES.ACCESS_DENIED;
  } else if (status === 404) {
    errorCode = PUBLIC_ERROR_CODES.RESOURCE_NOT_FOUND;
  } else if (status === 429) {
    errorCode = PUBLIC_ERROR_CODES.RATE_LIMIT_EXCEEDED;
  } else if (status === 503 && domain === 'generic') {
    errorCode = PUBLIC_ERROR_CODES.SERVICE_NOT_READY;
  } else {
    errorCode = domainFailureCode(domain);
  }

  const retryAfterSeconds = retryAfterOf(error);

  return {
    status,
    errorCode,
    message: PUBLIC_ERROR_MESSAGES[errorCode],
    ...(retryAfterSeconds ? { retryAfterSeconds } : {})
  };
}


export class PaymentRequestError extends Error {
  status: number;

  constructor(
    status: number,
    message: string,
    readonly code?: PublicErrorCode
  ) {
    super(message);
    this.name = 'PaymentRequestError';
    this.status = status;
  }
}

export class ReportGenerationInProgressError extends ReportRequestError {
  readonly code = PUBLIC_ERROR_CODES.REPORT_GENERATION_IN_PROGRESS;
  readonly retryAfterSeconds = 3;

  constructor() {
    super(409, 'Report generation is already in progress for this payment.');
    this.name = 'ReportGenerationInProgressError';
  }
}

export class KakaoAuthError extends Error {
  readonly code = PUBLIC_ERROR_CODES.AUTH_PROVIDER_FAILED;
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'KakaoAuthError';
    this.status = status;
  }
}
