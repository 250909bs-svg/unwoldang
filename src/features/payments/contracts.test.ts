import { describe, expect, it } from 'vitest';
import { assertConfirmedPayment, assertPaymentOrderIntent, paymentOrderStatuses } from './contracts';

const future = '2099-01-01T00:00:00.000Z';
const orderId = 'UW-20990101-contract-payment-0001';

describe('payment contracts', () => {
  it('exposes the exact six canonical order statuses', () => {
    expect(paymentOrderStatuses).toEqual([
      'created',
      'pending',
      'paid',
      'failed',
      'cancelled',
      'refunded'
    ]);
  });

  it('accepts only a server-priced created order intent', () => {
    const intent = assertPaymentOrderIntent(
      {
        orderId,
        productId: 'general-signature',
        amount: 79_000,
        currency: 'KRW',
        orderStatus: 'created',
        orderClaim: 'claim.'.padEnd(64, 'x'),
        orderClaimExpiresAt: future
      },
      { orderId, productId: 'general-signature' }
    );

    expect(intent.amount).toBe(79_000);
    expect(() =>
      assertPaymentOrderIntent(
        { ...intent, currency: 'USD' },
        { orderId, productId: 'general-signature' }
      )
    ).toThrow('무결성');
  });

  it('requires a paid response with one explicit active entitlement', () => {
    const response = {
      paymentId: orderId,
      txId: 'tx-contract-0001',
      orderId,
      productId: 'general-signature',
      amount: 79_000,
      currency: 'KRW',
      status: 'PAID',
      orderStatus: 'paid',
      entitlement: {
        id: 'a'.repeat(64),
        status: 'active',
        createdAt: future
      },
      reportAccessToken: 'report.'.padEnd(64, 'x'),
      reportAccessTokenExpiresAt: future
    };

    expect(
      assertConfirmedPayment(response, {
        paymentId: orderId,
        orderId,
        productId: 'general-signature',
        amount: 79_000
      }).entitlement.id
    ).toBe('a'.repeat(64));
    expect(() =>
      assertConfirmedPayment(
        { ...response, orderStatus: 'pending', reportAccessToken: undefined },
        {
          paymentId: orderId,
          orderId,
          productId: 'general-signature',
          amount: 79_000
        }
      )
    ).toThrow('무결성');
  });
});
