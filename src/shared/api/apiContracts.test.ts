import { describe, expect, it } from 'vitest';
import { resolvePaymentMode as legacyResolvePaymentMode } from '../../lib/runtimeConfig';
import { ApiError, isApiError } from './errors';
import { resolvePaymentMode } from './runtimeConfig';

describe('shared API error contract', () => {
  it('separates a stable diagnostic code from the existing user message', () => {
    const cause = new Error('internal-only detail');
    const error = new ApiError({
      code: 'PAYMENT_API_HTTP_ERROR',
      userMessage: '다시 시도해 주세요.',
      status: 502,
      cause
    });

    expect(isApiError(error)).toBe(true);
    expect(error.message).toBe('다시 시도해 주세요.');
    expect(error.userMessage).toBe('다시 시도해 주세요.');
    expect(error.code).toBe('PAYMENT_API_HTTP_ERROR');
    expect(error.status).toBe(502);
    expect(error.cause).toBe(cause);
  });
});

describe('runtime configuration facade', () => {
  it('re-exports the shared implementation by reference', () => {
    expect(legacyResolvePaymentMode).toBe(resolvePaymentMode);
  });
});
