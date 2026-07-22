import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCloudRunApi,
  normalizeRequestId,
  REQUEST_ID_HEADER
} from './cloudRunFetch';
import {
  createApiErrorFromPayload,
  getSafeErrorLogContext,
  readApiErrorResponse
} from './errorAdapter';
import { STANDARD_API_ERROR_CODES } from './errors';

const REQUEST_ID = '123e4567-e89b-42d3-a456-426614174000';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Cloud Run request correlation', () => {
  it('adds a UUID request ID without changing the caller body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchCloudRunApi('https://api.example.com/health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(normalizeRequestId(headers.get(REQUEST_ID_HEADER))).toBeTruthy();
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(init.body).toBe('{}');
  });

  it('preserves a valid UUID and replaces an unsafe caller value', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchCloudRunApi('https://api.example.com/one', {
      headers: { [REQUEST_ID_HEADER]: REQUEST_ID }
    });
    await fetchCloudRunApi('https://api.example.com/two', {
      headers: { [REQUEST_ID_HEADER]: 'customer@example.com' }
    });

    const firstHeaders = new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers);
    const secondHeaders = new Headers((fetchMock.mock.calls[1][1] as RequestInit).headers);
    expect(firstHeaders.get(REQUEST_ID_HEADER)).toBe(REQUEST_ID);
    expect(secondHeaders.get(REQUEST_ID_HEADER)).not.toBe('customer@example.com');
    expect(normalizeRequestId(secondHeaders.get(REQUEST_ID_HEADER))).toBeTruthy();
  });
});

describe('safe API error adapter', () => {
  it('keeps the complete standard error code contract', () => {
    expect(STANDARD_API_ERROR_CODES).toEqual([
      'REQUEST_INVALID', 'AUTH_REQUIRED', 'ACCESS_DENIED', 'RESOURCE_NOT_FOUND',
      'RATE_LIMIT_EXCEEDED', 'REPORT_ACCESS_REQUIRED', 'REPORT_GENERATION_IN_PROGRESS',
      'REPORT_GENERATION_FAILED', 'PAYMENT_REQUEST_FAILED', 'PAYMENT_CONFIRMATION_FAILED',
      'AUTH_PROVIDER_FAILED', 'ARCHIVE_OPERATION_FAILED', 'ADMIN_AUTH_FAILED',
      'SERVICE_NOT_READY', 'INTERNAL_ERROR'
    ]);
  });

  it('parses the standard envelope but never exposes the server message', async () => {
    const error = await readApiErrorResponse(new Response(JSON.stringify({
      errorCode: 'RATE_LIMIT_EXCEEDED',
      message: 'token=do-not-show',
      requestId: REQUEST_ID
    }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    }));

    expect(error).toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      message: `요청이 많습니다. 잠시 후 다시 시도해 주세요. 문의 코드: ${REQUEST_ID}`,
      userMessage: `요청이 많습니다. 잠시 후 다시 시도해 주세요. 문의 코드: ${REQUEST_ID}`,
      requestId: REQUEST_ID,
      status: 429
    });
    expect(error.message).not.toContain('token=');
  });

  it('uses a valid response header request ID as the inquiry code', async () => {
    const error = await readApiErrorResponse(new Response(JSON.stringify({
      errorCode: 'AUTH_PROVIDER_FAILED',
      message: 'raw provider message must stay private'
    }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        [REQUEST_ID_HEADER]: REQUEST_ID
      }
    }));

    expect(error.requestId).toBe(REQUEST_ID);
    expect(error.message).toBe(
      `로그인 처리에 실패했습니다. 잠시 후 다시 시도해 주세요. 문의 코드: ${REQUEST_ID}`
    );
    expect(error.message).not.toContain('raw provider message');
  });

  it('keeps the base safe message when body and header request IDs are invalid', async () => {
    const error = await readApiErrorResponse(new Response(JSON.stringify({
      errorCode: 'PAYMENT_CONFIRMATION_FAILED',
      message: 'token=raw-server-secret',
      requestId: 'token=invalid-body-id'
    }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        [REQUEST_ID_HEADER]: 'private@example.invalid'
      }
    }));

    expect(error.requestId).toBeUndefined();
    expect(error.message).toBe(
      '결제 확인에 실패했습니다. 결제 내역은 보존되므로 잠시 후 다시 시도해 주세요.'
    );
    expect(error.message).not.toContain('token=');
    expect(error.message).not.toContain('private@example.invalid');
  });

  it('parses a legacy code envelope and falls back safely for unknown codes', () => {
    const legacy = createApiErrorFromPayload({
      code: 'REPORT_GENERATION_IN_PROGRESS',
      message: 'internal provider detail'
    });
    const unknown = createApiErrorFromPayload({
      code: 'PROVIDER_SECRET_FAILURE',
      message: 'secret detail'
    }, { fallbackCode: 'AUTH_PROVIDER_FAILED' });

    expect(legacy.code).toBe('REPORT_GENERATION_IN_PROGRESS');
    expect(unknown.code).toBe('AUTH_PROVIDER_FAILED');
    expect(unknown.message).toBe(unknown.userMessage);
    expect(getSafeErrorLogContext(unknown)).toEqual({ errorCode: 'AUTH_PROVIDER_FAILED' });
  });
});
