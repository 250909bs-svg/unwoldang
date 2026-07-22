import { afterEach, describe, expect, it, vi } from 'vitest';
import { getProductById } from '../../products/registry';
import {
  confirmAuthenticatedPortOnePayment,
  fetchPaymentEntitlements,
  renewPaymentEntitlement
} from './api';

const confirmEndpoint = 'https://api.example.com/api/payments/portone/confirm';
const authToken = 'auth-token';
const orderId = 'UW-123456789012-order';
const productId = 'general-signature' as const;
const amount = 79_000;
const reportAccessToken = 'r'.repeat(48);
const reportAccessTokenExpiresAt = '2026-07-21T01:00:00.000Z';
const archivedProduct = getProductById('life-flow')!;
const archivedOrderId = 'UW-123456789012-archived';

const jsonResponse = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('authenticated PortOne API contracts', () => {
  it('preserves the confirm URL, headers, body and verified response shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      orderId,
      productId,
      amount,
      currency: 'KRW',
      reportAccessToken,
      reportAccessTokenExpiresAt,
      paymentId: orderId,
      txId: 'tx-1',
      status: 'PAID'
    }));
    vi.stubGlobal('fetch', fetchMock);

    const confirmed = await confirmAuthenticatedPortOnePayment({
      confirmEndpoint,
      authToken,
      paymentId: orderId,
      txId: 'tx-1',
      orderId,
      productId,
      amount,
      orderClaim: 'c'.repeat(48)
    });

    expect(confirmed.status).toBe('PAID');
    expect(fetchMock).toHaveBeenCalledWith(confirmEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        paymentId: orderId,
        txId: 'tx-1',
        orderId,
        productId,
        amount,
        orderClaim: 'c'.repeat(48)
      })
    });
  });

  it('rejects a confirm response that is not paid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      orderId,
      productId,
      amount,
      currency: 'KRW',
      reportAccessToken,
      reportAccessTokenExpiresAt,
      paymentId: orderId,
      txId: 'tx-1',
      status: 'FAILED'
    })));

    await expect(confirmAuthenticatedPortOnePayment({
      confirmEndpoint,
      authToken,
      paymentId: orderId,
      orderId,
      productId,
      amount,
      orderClaim: 'c'.repeat(48)
    })).rejects.toMatchObject({ code: 'PAYMENT_API_CONTRACT_VIOLATION' });
  });

  it('preserves entitlement list URL and bearer header', async () => {
    const entitlement = {
      orderId,
      productId,
      amount,
      currency: 'KRW',
      confirmedAt: '2026-07-21T00:00:00.000Z',
      status: 'active'
    } as const;
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ entitlements: [entitlement] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchPaymentEntitlements(confirmEndpoint, authToken)).resolves.toEqual([entitlement]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/payments/portone/entitlements',
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
  });

  it('accepts archived entitlement listing, renewal and confirmation recovery', async () => {
    const archivedEntitlement = {
      orderId: archivedOrderId,
      productId: archivedProduct.id,
      amount: archivedProduct.price,
      currency: 'KRW',
      confirmedAt: '2026-07-21T00:00:00.000Z',
      status: 'active'
    } as const;
    const archivedRenewed = {
      orderId: archivedOrderId,
      productId: archivedProduct.id,
      amount: archivedProduct.price,
      currency: 'KRW',
      reportAccessToken,
      reportAccessTokenExpiresAt
    } as const;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ entitlements: [archivedEntitlement] }))
      .mockResolvedValueOnce(jsonResponse(archivedRenewed))
      .mockResolvedValueOnce(jsonResponse({
        ...archivedRenewed,
        paymentId: archivedOrderId,
        txId: 'tx-archived',
        status: 'PAID'
      }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchPaymentEntitlements(confirmEndpoint, authToken)).resolves.toEqual([
      archivedEntitlement
    ]);
    await expect(
      renewPaymentEntitlement(confirmEndpoint, authToken, archivedOrderId)
    ).resolves.toEqual(archivedRenewed);
    await expect(confirmAuthenticatedPortOnePayment({
      confirmEndpoint,
      authToken,
      paymentId: archivedOrderId,
      orderId: archivedOrderId,
      productId: archivedProduct.id,
      amount: archivedProduct.price,
      orderClaim: 'c'.repeat(48)
    })).resolves.toMatchObject({
      productId: archivedProduct.id,
      paymentId: archivedOrderId,
      status: 'PAID'
    });
  });

  it('rejects an invalid entitlement list item', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      entitlements: [{ orderId, productId, amount: 0, currency: 'KRW', status: 'active' }]
    })));

    await expect(fetchPaymentEntitlements(confirmEndpoint, authToken)).rejects.toMatchObject({
      code: 'PAYMENT_API_CONTRACT_VIOLATION'
    });
  });

  it('preserves renew URL, bearer header and order body', async () => {
    const renewed = {
      orderId,
      productId,
      amount,
      currency: 'KRW',
      reportAccessToken,
      reportAccessTokenExpiresAt
    } as const;
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(renewed));
    vi.stubGlobal('fetch', fetchMock);

    await expect(renewPaymentEntitlement(confirmEndpoint, authToken, orderId)).resolves.toEqual(renewed);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/payments/portone/entitlement/renew',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderId })
      }
    );
  });
});
