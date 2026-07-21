import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../../cloudrun-api/src/config/env.ts';
import { PaymentRequestError, ReportRequestError } from '../../../cloudrun-api/src/contracts/errors.ts';
import { TokenService } from '../../../cloudrun-api/src/domains/auth/tokenService.ts';
import {
  assertPaymentOrderTransition,
  ENTITLEMENT_STATUS,
  PAYMENT_ORDER_STATUS,
  type PaymentOrderStatus
} from '../../../cloudrun-api/src/domains/payments/paymentContracts.ts';
import {
  PaymentService,
  type ConfirmedPaymentLedgerRecord,
  type PaymentLedgerRecord,
  type PaymentLedgerRepository,
  type PaymentOrderRecord,
  type PaymentOrderRepository,
  type PaymentOrderTransition
} from '../../../cloudrun-api/src/domains/payments/paymentService.ts';
import type {
  PortOnePayment,
  PortOnePaymentClient
} from '../../../cloudrun-api/src/domains/payments/portoneClient.ts';

const FIXED_NOW = Date.parse('2026-07-21T00:00:00.000Z');
const ORDER_ID = 'UW-20260721-payment-contract-0001';
const PRODUCT_ID = 'general-signature';
const PRODUCT_PRICE = 79_000;
const STORE_ID = 'store-contract-fixture';
const TRANSACTION_ID = 'tx-contract-fixture-0001';
const USER = { userId: 'kakao-contract-user-001' };
const OTHER_USER = { userId: 'kakao-contract-user-002' };

const ARCHIVED_ORDER_ID = 'UW-20260721-archived-contract-0001';
const ARCHIVED_PRODUCT_ID = 'life-flow';
const ARCHIVED_PRODUCT_PRICE = 59_000;
const ARCHIVED_TRANSACTION_ID = 'tx-archived-contract-fixture-0001';

class FakePortOneClient implements PortOnePaymentClient {
  payment: PortOnePayment = {};
  requestedPaymentIds: string[] = [];

  async fetchPayment(paymentId: string) {
    this.requestedPaymentIds.push(paymentId);
    return this.payment;
  }
}

class FakePaymentLedgerRepository implements PaymentLedgerRepository {
  readonly records = new Map<string, PaymentLedgerRecord>();
  listRecords: unknown;

  async createPaymentLedger(record: ConfirmedPaymentLedgerRecord) {
    const existing = this.records.get(record.entitlementId);

    if (existing) {
      return { kind: 'existing' as const, ledger: existing };
    }

    this.records.set(record.entitlementId, { ...record });
    return { kind: 'created' as const, ledger: { ...record } };
  }

  async getPaymentLedger(entitlementId: string) {
    return this.records.get(entitlementId) || null;
  }

  async listPaymentLedgersByUserId(_userId: string, _limit: number) {
    return this.listRecords === undefined ? [...this.records.values()] : this.listRecords;
  }

  async revokePaymentEntitlement(
    entitlementId: string,
    input: Parameters<PaymentLedgerRepository['revokePaymentEntitlement']>[1]
  ) {
    const existing = this.records.get(entitlementId);

    if (!existing) {
      throw new ReportRequestError(404, 'Payment ledger not found.');
    }

    if (
      existing.entitlementStatus === input.status &&
      existing.entitlementRevocationId === input.revocationId
    ) {
      return existing;
    }

    const canRevoke =
      existing.entitlementStatus === ENTITLEMENT_STATUS.ACTIVE ||
      (existing.entitlementStatus === ENTITLEMENT_STATUS.REVOKED &&
        input.status === ENTITLEMENT_STATUS.REFUNDED);

    if (!canRevoke) {
      throw new ReportRequestError(409, 'Invalid entitlement transition.');
    }

    const updated = {
      ...existing,
      entitlementStatus: input.status,
      entitlementUpdatedAt: input.revokedAt,
      entitlementRevokedAt: input.revokedAt,
      entitlementRevocationId: input.revocationId,
      entitlementRevocationReason: input.reason,
      entitlementRevocationProviderStatus: input.providerStatus
    };
    this.records.set(entitlementId, updated);
    return updated;
  }
}

class FakePaymentOrderRepository implements PaymentOrderRepository {
  readonly records = new Map<string, PaymentOrderRecord>();
  failNextTransition = false;

  async createPaymentOrder(
    record: Parameters<PaymentOrderRepository['createPaymentOrder']>[0]
  ) {
    const existing = this.records.get(record.orderId);

    if (existing) {
      return { kind: 'existing' as const, order: existing };
    }

    const stored: PaymentOrderRecord = {
      ...record,
      providerStatus: '',
      paymentId: '',
      transactionId: '',
      statusUpdatedAt: record.createdAt,
      adjustmentId: '',
      adjustmentKind: '',
      adjustmentReason: '',
      adjustmentAt: ''
    };
    this.records.set(record.orderId, stored);
    return { kind: 'created' as const, order: stored };
  }

  async getPaymentOrder(orderId: string) {
    return this.records.get(orderId) || null;
  }

  async transitionPaymentOrder(
    order: PaymentOrderRecord,
    input: PaymentOrderTransition
  ) {
    if (this.failNextTransition) {
      this.failNextTransition = false;
      throw new ReportRequestError(503, 'Fixture transition failure.');
    }

    assertPaymentOrderTransition(order.status as PaymentOrderStatus, input.status);
    const updated: PaymentOrderRecord = {
      ...order,
      status: input.status,
      providerStatus: input.providerStatus,
      paymentId: input.paymentId,
      transactionId: input.transactionId,
      statusUpdatedAt: input.statusUpdatedAt,
      adjustmentId: input.adjustment?.id || '',
      adjustmentKind: input.adjustment?.kind || '',
      adjustmentReason: input.adjustment?.reason || '',
      adjustmentAt: input.adjustment?.occurredAt || ''
    };
    this.records.set(String(order.orderId), updated);
    return updated;
  }
}

function createHarness() {
  const config = loadConfig({
    NODE_ENV: 'production',
    REPORT_ACCESS_SECRET: 'fixture-report-access-secret-not-for-production',
    USER_ACCESS_SECRET: 'fixture-user-access-secret-not-for-production',
    ADMIN_ACCESS_SECRET: 'fixture-admin-access-secret-not-for-production',
    PAYMENT_ORDER_CLAIM_TTL_MS: '7200000',
    REPORT_ACCESS_TOKEN_TTL_MS: '1800000'
  });
  const tokenService = new TokenService(config);
  const portOneClient = new FakePortOneClient();
  const ledgerRepository = new FakePaymentLedgerRepository();
  const orderRepository = new FakePaymentOrderRepository();
  const paymentService = new PaymentService({
    config: {
      storeId: STORE_ID,
      orderClaimTtlMs: config.report.orderClaimTtlMs,
      reportAccessTokenTtlMs: config.report.accessTokenTtlMs
    },
    portOneClient,
    ledgerRepository,
    orderRepository,
    tokenService,
    now: () => FIXED_NOW,
    randomBytes: (size) => Buffer.alloc(size, 7)
  });

  return {
    config,
    tokenService,
    portOneClient,
    ledgerRepository,
    orderRepository,
    paymentService
  };
}

function entitlementIdFor(paymentId: string) {
  return createHash('sha256').update(`portone:${paymentId}`).digest('hex');
}

async function createOrder(harness: ReturnType<typeof createHarness>) {
  return harness.paymentService.createOrderIntent(USER, {
    orderId: ORDER_ID,
    productId: PRODUCT_ID
  });
}

function confirmationBody(orderClaim: string) {
  return {
    paymentId: ORDER_ID,
    orderId: ORDER_ID,
    productId: PRODUCT_ID,
    amount: PRODUCT_PRICE,
    txId: TRANSACTION_ID,
    orderClaim
  };
}

function setPayment(
  harness: ReturnType<typeof createHarness>,
  orderClaim: string,
  overrides: Record<string, unknown> = {}
) {
  harness.portOneClient.payment = {
    id: ORDER_ID,
    status: 'PAID',
    storeId: STORE_ID,
    currency: 'KRW',
    amount: { total: PRODUCT_PRICE },
    transactionId: TRANSACTION_ID,
    customData: { productId: PRODUCT_ID, orderClaim },
    method: { type: 'CARD' },
    paidAt: '2026-07-21T00:00:01.000Z',
    ...overrides
  };
}

describe('Cloud Run payment contracts', () => {
  it('defines six guarded order states and separate entitlement states', () => {
    expect(Object.values(PAYMENT_ORDER_STATUS)).toEqual([
      'created',
      'pending',
      'paid',
      'failed',
      'cancelled',
      'refunded'
    ]);
    expect(Object.values(ENTITLEMENT_STATUS)).toEqual([
      'active',
      'revoked',
      'refunded'
    ]);
    expect(() =>
      assertPaymentOrderTransition(
        PAYMENT_ORDER_STATUS.PAID,
        PAYMENT_ORDER_STATUS.REFUNDED
      )
    ).not.toThrow();
    expect(() =>
      assertPaymentOrderTransition(
        PAYMENT_ORDER_STATUS.FAILED,
        PAYMENT_ORDER_STATUS.PAID
      )
    ).toThrow(PaymentRequestError);
  });

  it('persists a server-priced, user-bound created order before returning its claim', async () => {
    const harness = createHarness();
    const order = await createOrder(harness);
    const claims = harness.tokenService.verifyPaymentOrderClaim(order.orderClaim, USER.userId);

    expect(order).toMatchObject({
      orderId: ORDER_ID,
      productId: PRODUCT_ID,
      amount: PRODUCT_PRICE,
      currency: 'KRW',
      orderStatus: 'created'
    });
    expect(harness.orderRepository.records.get(ORDER_ID)).toMatchObject({
      orderId: ORDER_ID,
      productId: PRODUCT_ID,
      amount: PRODUCT_PRICE,
      currency: 'KRW',
      productStatusSnapshot: 'active',
      userId: USER.userId,
      userBinding: harness.tokenService.createUserBinding(USER.userId),
      orderClaimHash: createHash('sha256').update(order.orderClaim).digest('hex'),
      status: 'created',
      providerStatus: ''
    });
    expect(claims).toMatchObject({
      orderId: ORDER_ID,
      productId: PRODUCT_ID,
      amount: PRODUCT_PRICE,
      userBinding: harness.tokenService.createUserBinding(USER.userId)
    });
    expect(() =>
      harness.paymentService.createOrderIntent(USER, {
        orderId: 'UW-price-tamper-contract-0001',
        productId: PRODUCT_ID,
        amount: 1
      })
    ).toThrow(PaymentRequestError);
  });

  it('confirms PAID exactly once and returns a stable entitlement on retries', async () => {
    const harness = createHarness();
    const order = await createOrder(harness);
    setPayment(harness, order.orderClaim);
    const body = confirmationBody(order.orderClaim);
    const first = await harness.paymentService.confirmPayment(USER, body);
    const second = await harness.paymentService.confirmPayment(USER, body);
    const entitlementId = entitlementIdFor(ORDER_ID);

    expect(first).toMatchObject({
      paymentId: ORDER_ID,
      txId: TRANSACTION_ID,
      orderId: ORDER_ID,
      productId: PRODUCT_ID,
      amount: PRODUCT_PRICE,
      currency: 'KRW',
      status: 'PAID',
      orderStatus: 'paid',
      entitlement: {
        id: entitlementId,
        status: 'active',
        createdAt: '2026-07-21T00:00:00.000Z'
      }
    });
    expect(second.entitlement.id).toBe(first.entitlement.id);
    expect(second.reportAccessToken).not.toBe(first.reportAccessToken);
    expect(harness.ledgerRepository.records.size).toBe(1);
    expect(harness.orderRepository.records.get(ORDER_ID)).toMatchObject({
      status: 'paid',
      providerStatus: 'PAID',
      paymentId: ORDER_ID,
      transactionId: TRANSACTION_ID
    });
    expect(
      harness.tokenService.verifyReportAccessToken(first.reportAccessToken)
    ).toMatchObject({ entitlementId, amount: PRODUCT_PRICE, productId: PRODUCT_ID });
  });

  it('reuses a persisted entitlement after the original order claim expires', async () => {
    const harness = createHarness();
    const order = await createOrder(harness);
    setPayment(harness, order.orderClaim);
    const body = confirmationBody(order.orderClaim);
    const first = await harness.paymentService.confirmPayment(USER, body);
    const verifyClaim = vi
      .spyOn(harness.tokenService, 'verifyPaymentOrderClaim')
      .mockImplementation(() => {
        throw new ReportRequestError(401, 'Access token has expired.');
      });

    const retried = await harness.paymentService.confirmPayment(USER, body);

    expect(retried.entitlement.id).toBe(first.entitlement.id);
    expect(harness.ledgerRepository.records.size).toBe(1);
    expect(verifyClaim).not.toHaveBeenCalled();
  });

  it.each([
    ['provider payment id', (payment: Record<string, unknown>) => { payment.id = 'other-payment'; }],
    ['amount', (payment: Record<string, unknown>) => { payment.amount = { total: 1 }; }],
    ['store id', (payment: Record<string, unknown>) => { payment.storeId = 'other-store'; }],
    ['currency', (payment: Record<string, unknown>) => { payment.currency = 'USD'; }],
    ['product custom data', (payment: Record<string, unknown>) => {
      payment.customData = { ...(payment.customData as object), productId: 'love-reading' };
    }],
    ['order claim', (payment: Record<string, unknown>) => {
      payment.customData = { ...(payment.customData as object), orderClaim: 'other-claim' };
    }],
    ['transaction id', (payment: Record<string, unknown>) => { payment.transactionId = 'other-tx'; }],
    ['missing transaction id', (payment: Record<string, unknown>) => { delete payment.transactionId; }]
  ])('rejects mismatched PortOne %s without issuing access', async (_label, mutate) => {
    const harness = createHarness();
    const order = await createOrder(harness);
    setPayment(harness, order.orderClaim);
    mutate(harness.portOneClient.payment);

    await expect(
      harness.paymentService.confirmPayment(USER, confirmationBody(order.orderClaim))
    ).rejects.toMatchObject({ status: 409 });
    expect(harness.ledgerRepository.records.size).toBe(0);
  });

  it.each([
    ['READY', 'pending'],
    ['PENDING', 'pending'],
    ['PAY_PENDING', 'pending'],
    ['VIRTUAL_ACCOUNT_ISSUED', 'pending'],
    ['FAILED', 'failed'],
    ['CANCELLED', 'cancelled']
  ] as const)(
    'persists provider %s as %s without an entitlement',
    async (providerStatus, orderStatus) => {
      const harness = createHarness();
      const order = await createOrder(harness);
      setPayment(harness, order.orderClaim, { status: providerStatus });

      await expect(
        harness.paymentService.confirmPayment(USER, confirmationBody(order.orderClaim))
      ).rejects.toMatchObject({ status: 409 });
      expect(harness.orderRepository.records.get(ORDER_ID)).toMatchObject({
        status: orderStatus,
        providerStatus
      });
      expect(harness.ledgerRepository.records.size).toBe(0);
    }
  );

  it('repairs a ledger/order partial failure before issuing a report token', async () => {
    const harness = createHarness();
    const order = await createOrder(harness);
    setPayment(harness, order.orderClaim);
    harness.orderRepository.failNextTransition = true;

    await expect(
      harness.paymentService.confirmPayment(USER, confirmationBody(order.orderClaim))
    ).rejects.toMatchObject({ status: 503 });
    expect(harness.ledgerRepository.records.size).toBe(1);
    expect(harness.orderRepository.records.get(ORDER_ID)).toMatchObject({ status: 'created' });

    const repaired = await harness.paymentService.confirmPayment(
      USER,
      confirmationBody(order.orderClaim)
    );
    expect(repaired.entitlement.id).toBe(entitlementIdFor(ORDER_ID));
    expect(repaired.orderStatus).toBe('paid');
    expect(harness.ledgerRepository.records.size).toBe(1);
  });

  it('reconciles provider cancellation idempotently and revokes paid access', async () => {
    const harness = createHarness();
    const order = await createOrder(harness);
    setPayment(harness, order.orderClaim);
    const paid = await harness.paymentService.confirmPayment(
      USER,
      confirmationBody(order.orderClaim)
    );
    harness.portOneClient.payment.status = 'PARTIAL_CANCELLED';

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(
        harness.paymentService.confirmPayment(USER, confirmationBody(order.orderClaim))
      ).rejects.toMatchObject({ status: 409 });
    }

    expect(harness.orderRepository.records.get(ORDER_ID)).toMatchObject({
      status: 'refunded',
      providerStatus: 'PARTIAL_CANCELLED',
      adjustmentKind: 'refund',
      adjustmentId: expect.any(String)
    });
    expect(harness.ledgerRepository.records.get(paid.entitlement.id)).toMatchObject({
      entitlementStatus: 'refunded',
      entitlementRevocationProviderStatus: 'PARTIAL_CANCELLED',
      entitlementRevocationId: expect.any(String)
    });
    await expect(
      harness.paymentService.renewEntitlement(USER, { orderId: ORDER_ID })
    ).rejects.toMatchObject({ status: 409 });
    expect(await harness.paymentService.queryEntitlements(USER)).toEqual([]);
  });

  it('masks ownership and never renews a revoked entitlement', async () => {
    const harness = createHarness();
    const order = await createOrder(harness);
    setPayment(harness, order.orderClaim);
    const paid = await harness.paymentService.confirmPayment(
      USER,
      confirmationBody(order.orderClaim)
    );

    await expect(
      harness.paymentService.renewEntitlement(OTHER_USER, { orderId: ORDER_ID })
    ).rejects.toMatchObject({ status: 404 });

    const ledger = harness.ledgerRepository.records.get(paid.entitlement.id);
    harness.ledgerRepository.records.set(paid.entitlement.id, {
      ...ledger,
      entitlementStatus: ENTITLEMENT_STATUS.REVOKED
    });
    await expect(
      harness.paymentService.renewEntitlement(USER, { orderId: ORDER_ID })
    ).rejects.toMatchObject({ status: 409 });
    expect(await harness.paymentService.queryEntitlements(USER)).toEqual([]);
  });

  it('preserves legacy archived-order confirmation with current catalog fallback', async () => {
    const harness = createHarness();
    const orderClaim = harness.tokenService.createPaymentOrderClaim({
      userId: USER.userId,
      orderId: ARCHIVED_ORDER_ID,
      productId: ARCHIVED_PRODUCT_ID,
      amount: ARCHIVED_PRODUCT_PRICE
    });
    harness.portOneClient.payment = {
      id: ARCHIVED_ORDER_ID,
      status: 'PAID',
      storeId: STORE_ID,
      currency: 'KRW',
      amount: { total: ARCHIVED_PRODUCT_PRICE },
      transactionId: ARCHIVED_TRANSACTION_ID,
      customData: { productId: ARCHIVED_PRODUCT_ID, orderClaim }
    };

    const confirmed = await harness.paymentService.confirmPayment(USER, {
      paymentId: ARCHIVED_ORDER_ID,
      orderId: ARCHIVED_ORDER_ID,
      productId: ARCHIVED_PRODUCT_ID,
      amount: ARCHIVED_PRODUCT_PRICE,
      txId: ARCHIVED_TRANSACTION_ID,
      orderClaim
    });

    expect(confirmed).toMatchObject({
      status: 'PAID',
      orderStatus: 'paid',
      productId: ARCHIVED_PRODUCT_ID,
      amount: ARCHIVED_PRODUCT_PRICE,
      entitlement: { status: 'active' }
    });
    expect(harness.orderRepository.records.get(ARCHIVED_ORDER_ID)).toMatchObject({
      source: 'legacy',
      productStatusSnapshot: 'archived',
      status: 'paid'
    });
  });
});
