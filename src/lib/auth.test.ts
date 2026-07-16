import { describe, expect, it, vi } from 'vitest';
import { createOrderId, getPortOnePaymentApiEndpoint, requestPaymentOrderIntent } from './auth';

describe('payment identity helpers', () => {
  it('creates a Web Crypto order id without Math.random', () => {
    const weakRandom = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be used for payment ids.');
    });

    try {
      const first = createOrderId();
      const second = createOrderId();

      expect(first).toMatch(/^UW-\d+-[a-f0-9]{32}$/);
      expect(second).not.toBe(first);
    } finally {
      weakRandom.mockRestore();
    }
  });

  it('derives only known payment API paths from the configured confirm endpoint', () => {
    const confirm = 'https://api.example.com/api/payments/portone/confirm';

    expect(getPortOnePaymentApiEndpoint(confirm, 'order')).toBe(
      'https://api.example.com/api/payments/portone/order'
    );
    expect(getPortOnePaymentApiEndpoint(confirm, 'entitlement/renew')).toBe(
      'https://api.example.com/api/payments/portone/entitlement/renew'
    );
    expect(() => getPortOnePaymentApiEndpoint('https://api.example.com/report', 'order')).toThrow();
  });

  it('rejects a malformed successful payment API response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );

    try {
      await expect(
        requestPaymentOrderIntent({
          confirmEndpoint: 'https://api.example.com/api/payments/portone/confirm',
          authToken: 'auth-token',
          orderId: 'UW-123456789012-abcdef',
          productId: 'general-signature',
          amount: 79_000
        })
      ).rejects.toThrow('무결성');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
