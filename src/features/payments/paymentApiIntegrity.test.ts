import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  confirmAuthenticatedPortOnePayment,
  fetchPaymentEntitlements,
  renewPaymentEntitlement
} from './api';

const confirmEndpoint = 'https://api.example.com/api/payments/portone/confirm';
const orderId = 'UW-123456789012-order';
const validRenewed = {
  orderId,
  productId: 'general-signature',
  amount: 79_000,
  currency: 'KRW',
  reportAccessToken: 'r'.repeat(48),
  reportAccessTokenExpiresAt: '2026-07-21T01:00:00.000Z'
} as const;

const response = (payload: unknown) => new Response(JSON.stringify(payload), {
  status: 200,
  headers: { 'Content-Type': 'application/json' }
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('payment entitlement response integrity', () => {
  it.each([
    ['orderId', { orderId: 'UW-999999999999-other' }],
    ['productId', { productId: 'love-reading' }],
    ['amount', { amount: 1 }],
    ['currency', { currency: 'USD' }],
    ['reportAccessToken', { reportAccessToken: 'short' }]
  ] as const)('rejects a confirm response with mismatched %s', async (_field, mismatch) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      ...validRenewed,
      ...mismatch,
      paymentId: orderId,
      txId: 'tx-1',
      status: 'PAID'
    })));

    await expect(confirmAuthenticatedPortOnePayment({
      confirmEndpoint,
      authToken: 'auth-token',
      paymentId: orderId,
      orderId,
      productId: 'general-signature',
      amount: 79_000,
      orderClaim: 'c'.repeat(48)
    })).rejects.toMatchObject({ code: 'PAYMENT_API_CONTRACT_VIOLATION' });
  });

  it.each([
    ['orderId mismatch', { orderId: 'UW-999999999999-other' }],
    ['missing token', { reportAccessToken: undefined }],
    ['invalid expiry', { reportAccessTokenExpiresAt: 'not-a-date' }],
    ['unknown product', { productId: 'unknown-product' }],
    ['catalog price mismatch', { amount: 1 }]
  ] as const)('rejects a renewed entitlement with %s', async (_label, mismatch) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      ...validRenewed,
      ...mismatch
    })));

    await expect(renewPaymentEntitlement(
      confirmEndpoint,
      'auth-token',
      orderId
    )).rejects.toMatchObject({ code: 'PAYMENT_API_CONTRACT_VIOLATION' });
  });

  it.each([
    ['unknown product', { productId: 'unknown-product' }],
    ['catalog price mismatch', { amount: 1 }]
  ] as const)('rejects an entitlement list item with %s', async (_label, mismatch) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      entitlements: [{
        orderId,
        productId: 'general-signature',
        amount: 79_000,
        currency: 'KRW',
        confirmedAt: '2026-07-21T00:00:00.000Z',
        status: 'active',
        ...mismatch
      }]
    })));

    await expect(fetchPaymentEntitlements(
      confirmEndpoint,
      'auth-token'
    )).rejects.toMatchObject({ code: 'PAYMENT_API_CONTRACT_VIOLATION' });
  });
});
