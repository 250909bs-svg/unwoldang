import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PaymentSession } from './contracts';
import { confirmPaymentSession, createPaymentOrder, PaymentApiError } from './api';

const confirmEndpoint = 'https://api.example.com/api/payments/portone/confirm';
const orderId = 'UW-20990101-api-payment-0001';
const future = '2099-01-01T00:00:00.000Z';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('payment API', () => {
  it('omits client amount when requesting the authoritative server order', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          orderId,
          productId: 'general-signature',
          amount: 79_000,
          currency: 'KRW',
          orderStatus: 'created',
          orderClaim: 'claim.'.padEnd(64, 'x'),
          orderClaimExpiresAt: future
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await createPaymentOrder({
      confirmEndpoint,
      authToken: 'user-token',
      orderId,
      productId: 'general-signature'
    });

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      orderId,
      productId: 'general-signature'
    });
  });

  it('retries confirmation with the identical payment binding', async () => {
    const session: PaymentSession = {
      schemaVersion: 1,
      ownerId: 'user-a',
      orderId,
      productId: 'general-signature',
      paymentMethod: 'portone',
      amount: 79_000,
      currency: 'KRW',
      status: 'pending',
      paymentId: orderId,
      txId: 'tx-api-0001',
      orderClaim: 'claim.'.padEnd(64, 'x'),
      orderClaimExpiresAt: future,
      createdAt: future,
      updatedAt: future
    };
    const success = {
      paymentId: orderId,
      txId: 'tx-api-0001',
      orderId,
      productId: 'general-signature',
      amount: 79_000,
      currency: 'KRW',
      status: 'PAID',
      orderStatus: 'paid',
      entitlement: {
        id: 'b'.repeat(64),
        status: 'active',
        createdAt: future
      },
      reportAccessToken: 'report.'.padEnd(64, 'x'),
      reportAccessTokenExpiresAt: future
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'temporary outage' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(success), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      confirmPaymentSession({ confirmEndpoint, authToken: 'user-token', session })
    ).rejects.toMatchObject<Partial<PaymentApiError>>({ retryable: true });
    const confirmed = await confirmPaymentSession({
      confirmEndpoint,
      authToken: 'user-token',
      session
    });
    const firstBody = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    const secondBody = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));

    expect(secondBody).toEqual(firstBody);
    expect(confirmed.entitlement.id).toBe('b'.repeat(64));
  });
});
