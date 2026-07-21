import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestPaymentMock = vi.hoisted(() => vi.fn());

vi.mock('../../lib/portonePayments', () => ({
  requestPortOnePayment: requestPaymentMock
}));

import { openPortOnePayment } from './portone';

const intent = {
  orderId: 'UW-20990101-portone-payment-0001',
  productId: 'general-signature' as const,
  amount: 79_000,
  currency: 'KRW' as const,
  orderStatus: 'created' as const,
  orderClaim: 'claim.'.padEnd(64, 'x'),
  orderClaimExpiresAt: '2099-01-01T00:00:00.000Z'
};

beforeEach(() => {
  requestPaymentMock.mockReset();
});

describe('PortOne browser request', () => {
  it('uses the exact server order amount and custom data', async () => {
    requestPaymentMock.mockResolvedValue({
      paymentId: intent.orderId,
      txId: 'tx-portone-0001'
    });

    await expect(
      openPortOnePayment({
        intent,
        storeId: 'store-live',
        channelKey: 'channel-live',
        orderName: '운월선생 정통 종합사주',
        customerId: 'uw.opaque',
        redirectUrl: 'https://example.com/payment/portone/callback'
      })
    ).resolves.toMatchObject({ kind: 'submitted', paymentId: intent.orderId });

    expect(requestPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: intent.orderId,
        totalAmount: 79_000,
        customData: {
          productId: 'general-signature',
          paymentMethod: 'portone',
          orderClaim: intent.orderClaim
        }
      })
    );
  });

  it('separates a closed payment window from a provider failure', async () => {
    requestPaymentMock.mockResolvedValueOnce(undefined);
    await expect(
      openPortOnePayment({
        intent,
        storeId: 'store-live',
        channelKey: 'channel-live',
        orderName: '상품',
        customerId: 'uw.opaque',
        redirectUrl: 'https://example.com/callback'
      })
    ).resolves.toMatchObject({ kind: 'cancelled' });

    requestPaymentMock.mockRejectedValueOnce(new Error('PG 승인 실패'));
    await expect(
      openPortOnePayment({
        intent,
        storeId: 'store-live',
        channelKey: 'channel-live',
        orderName: '상품',
        customerId: 'uw.opaque',
        redirectUrl: 'https://example.com/callback'
      })
    ).resolves.toMatchObject({ kind: 'failed' });
  });
});
