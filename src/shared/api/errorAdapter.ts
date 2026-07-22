import { normalizeRequestId, REQUEST_ID_HEADER } from './cloudRunFetch';
import {
  ApiError,
  STANDARD_API_ERROR_CODES,
  type ApiErrorCode,
  type LegacyPaymentApiErrorCode,
  type StandardApiErrorCode
} from './errors';

const LEGACY_PAYMENT_API_ERROR_CODES = [
  'PAYMENT_API_ENDPOINT_INVALID',
  'PAYMENT_API_NETWORK_ERROR',
  'PAYMENT_API_HTTP_ERROR',
  'PAYMENT_API_RESPONSE_INVALID',
  'PAYMENT_API_CONTRACT_VIOLATION'
] as const satisfies readonly LegacyPaymentApiErrorCode[];

const SAFE_ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  REQUEST_INVALID: '입력 정보를 확인한 뒤 다시 시도해 주세요.',
  AUTH_REQUIRED: '로그인 후 다시 시도해 주세요.',
  ACCESS_DENIED: '이 요청을 처리할 권한이 없습니다.',
  RESOURCE_NOT_FOUND: '요청한 정보를 찾을 수 없습니다.',
  RATE_LIMIT_EXCEEDED: '요청이 많습니다. 잠시 후 다시 시도해 주세요.',
  REPORT_ACCESS_REQUIRED: '결제 리포트 접근 권한을 확인할 수 없습니다. 로그인 후 다시 시도해 주세요.',
  REPORT_GENERATION_IN_PROGRESS: '리포트를 생성하고 있습니다. 잠시 후 다시 확인해 주세요.',
  REPORT_GENERATION_FAILED: '리포트 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  PAYMENT_REQUEST_FAILED: '결제 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  PAYMENT_CONFIRMATION_FAILED: '결제 확인에 실패했습니다. 결제 내역은 보존되므로 잠시 후 다시 시도해 주세요.',
  AUTH_PROVIDER_FAILED: '로그인 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  ARCHIVE_OPERATION_FAILED: '리포트 보관함 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  ADMIN_AUTH_FAILED: '관리자 인증에 실패했습니다.',
  SERVICE_NOT_READY: '서비스 준비가 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.',
  INTERNAL_ERROR: '요청 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  PAYMENT_API_ENDPOINT_INVALID: 'PortOne 결제 확인 API 주소가 올바르지 않습니다.',
  PAYMENT_API_NETWORK_ERROR: '결제 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  PAYMENT_API_HTTP_ERROR: '결제 권한 처리 중 오류가 발생했습니다.',
  PAYMENT_API_RESPONSE_INVALID: '결제 권한 서버 응답 형식이 올바르지 않습니다.',
  PAYMENT_API_CONTRACT_VIOLATION: '결제 서버 응답의 무결성을 확인할 수 없습니다.'
};

type ApiErrorEnvelope = {
  errorCode?: unknown;
  code?: unknown;
  message?: unknown;
  requestId?: unknown;
};

type ApiErrorFallback = {
  fallbackCode?: ApiErrorCode;
  status?: number;
  requestId?: string;
  cause?: unknown;
};

const KNOWN_ERROR_CODES = new Set<string>([
  ...STANDARD_API_ERROR_CODES,
  ...LEGACY_PAYMENT_API_ERROR_CODES
]);

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && KNOWN_ERROR_CODES.has(value);
}

export function getSafeApiErrorMessage(code: ApiErrorCode) {
  return SAFE_ERROR_MESSAGES[code];
}

function getStatusErrorCode(status: number | undefined): StandardApiErrorCode {
  switch (status) {
    case 400:
    case 422:
      return 'REQUEST_INVALID';
    case 401:
      return 'AUTH_REQUIRED';
    case 403:
      return 'ACCESS_DENIED';
    case 404:
      return 'RESOURCE_NOT_FOUND';
    case 429:
      return 'RATE_LIMIT_EXCEEDED';
    case 503:
      return 'SERVICE_NOT_READY';
    default:
      return 'INTERNAL_ERROR';
  }
}

function resolveFallbackCode(fallback: ApiErrorFallback) {
  return fallback.fallbackCode || getStatusErrorCode(fallback.status);
}

function appendRequestId(message: string, requestId: string | undefined) {
  return requestId ? `${message} 문의 코드: ${requestId}` : message;
}

export function createApiErrorFromPayload(payload: unknown, fallback: ApiErrorFallback = {}) {
  const envelope = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as ApiErrorEnvelope
    : null;
  const rawCode = envelope?.errorCode ?? envelope?.code;
  const code = isApiErrorCode(rawCode) ? rawCode : resolveFallbackCode(fallback);
  const requestId = normalizeRequestId(envelope?.requestId) || normalizeRequestId(fallback.requestId);

  return new ApiError({
    code,
    userMessage: appendRequestId(getSafeApiErrorMessage(code), requestId),
    status: fallback.status,
    requestId,
    cause: fallback.cause
  });
}

export async function readApiErrorResponse(
  response: Response,
  fallback: Omit<ApiErrorFallback, 'status' | 'requestId'> = {}
) {
  const payload = await response.json().catch(() => null);

  return createApiErrorFromPayload(payload, {
    ...fallback,
    status: response.status,
    requestId: response.headers.get(REQUEST_ID_HEADER) || undefined
  });
}

export function adaptApiError(error: unknown, fallback: ApiErrorFallback = {}) {
  if (error instanceof ApiError) {
    return error;
  }

  const code = resolveFallbackCode(fallback);
  return new ApiError({
    code,
    userMessage: getSafeApiErrorMessage(code),
    status: fallback.status,
    requestId: normalizeRequestId(fallback.requestId),
    cause: error
  });
}

export function getSafeErrorMessage(error: unknown, fallbackCode: ApiErrorCode = 'INTERNAL_ERROR') {
  return adaptApiError(error, { fallbackCode }).userMessage;
}

export function getSafeErrorLogContext(error: unknown, fallbackCode: ApiErrorCode = 'INTERNAL_ERROR') {
  const adapted = adaptApiError(error, { fallbackCode });

  return {
    errorCode: adapted.code,
    ...(adapted.status !== undefined ? { status: adapted.status } : {}),
    ...(adapted.requestId ? { requestId: adapted.requestId } : {})
  };
}
