import type { ServerResponse } from 'node:http';
import {
  normalizePublicError,
  PUBLIC_ERROR_CODES,
  PUBLIC_ERROR_MESSAGES,
  type ErrorDomain,
  type PublicErrorCode
} from '../contracts/errors.ts';
import {
  getRequestId,
  recordTrustedRequestAttributes,
  recordRequestError
} from '../observability/requestContext.ts';
import { applySecurityHeaders } from './security.ts';

export function sendJson(res: ServerResponse, status: number, payload: unknown) {
  recordTrustedRequestAttributes(payload);
  res.statusCode = status;
  applySecurityHeaders(res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

export function sendPublicError(
  res: ServerResponse,
  status: number,
  errorCode: PublicErrorCode,
  extra: Record<string, unknown> = {}
) {
  recordRequestError(errorCode);
  const requestId = getRequestId();

  sendJson(res, status, {
    ...extra,
    errorCode,
    message: PUBLIC_ERROR_MESSAGES[errorCode],
    ...(requestId ? { requestId } : {})
  });
}

export function sendApiError(res: ServerResponse, error: unknown, domain: ErrorDomain) {
  const normalized = normalizePublicError(error, domain);

  if (normalized.retryAfterSeconds) {
    res.setHeader('Retry-After', String(normalized.retryAfterSeconds));
  }

  sendPublicError(
    res,
    normalized.status,
    normalized.errorCode,
    {
      ...(normalized.errorCode === PUBLIC_ERROR_CODES.REPORT_GENERATION_IN_PROGRESS
        ? { code: normalized.errorCode }
        : {}),
      ...(normalized.retryAfterSeconds
        ? { retryAfterSeconds: normalized.retryAfterSeconds }
        : {})
    }
  );
}
