import type { ServerResponse } from 'node:http';
import { API_ERROR_CODE, type ApiErrorCode } from '../contracts/api.ts';
import { applySecurityHeaders } from './security.ts';

const PUBLIC_INTERNAL_ERROR_MESSAGE =
  '요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.';
const PUBLIC_API_ERROR_CODES = new Set<string>(Object.values(API_ERROR_CODE));

function apiErrorCodeForStatus(status: number): ApiErrorCode {
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
  return API_ERROR_CODE.INTERNAL_ERROR;
}

function normalizeErrorPayload(status: number, payload: unknown) {
  if (
    status < 400 ||
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    typeof (payload as { message?: unknown }).message !== 'string'
  ) {
    return payload;
  }

  const source = payload as Record<string, unknown>;
  const normalized: Record<string, unknown> = {
    code:
      typeof source.code === 'string' && PUBLIC_API_ERROR_CODES.has(source.code)
        ? source.code
        : apiErrorCodeForStatus(status),
    message: status >= 500 ? PUBLIC_INTERNAL_ERROR_MESSAGE : source.message
  };

  if (
    status < 500 &&
    typeof source.retryAfterSeconds === 'number' &&
    Number.isSafeInteger(source.retryAfterSeconds) &&
    source.retryAfterSeconds > 0
  ) {
    normalized.retryAfterSeconds = source.retryAfterSeconds;
  }

  if (status === 404 && Array.isArray(source.routes)) {
    normalized.routes = source.routes.filter((route) => typeof route === 'string');
  }

  return normalized;
}

export function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  applySecurityHeaders(res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(normalizeErrorPayload(status, payload)));
}
