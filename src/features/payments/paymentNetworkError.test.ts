import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../shared/api/errors';
import { requestPaymentOrderIntent } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('payment network errors', () => {
  it('keeps diagnostics in cause and exposes a fixed user message and code', async () => {
    const cause = new TypeError('Failed to fetch https://internal-provider.example');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(cause));

    const error = await requestPaymentOrderIntent({
      confirmEndpoint: 'https://api.example.com/api/payments/portone/confirm',
      authToken: 'auth-token',
      productId: 'general-signature',
      amount: 79_000
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: 'PAYMENT_API_NETWORK_ERROR',
      message: '결제 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
      userMessage: '결제 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
      cause
    });
  });
});
