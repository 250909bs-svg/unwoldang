import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../cloudrun-api/src/config/env.ts';
import { ReportRequestError } from '../../../cloudrun-api/src/contracts/errors.ts';
import { TokenService } from '../../../cloudrun-api/src/domains/auth/tokenService.ts';
import {
  PaymentService,
  type ConfirmedPaymentLedgerRecord,
  type PaymentLedgerRecord,
  type PaymentLedgerRepository
} from '../../../cloudrun-api/src/domains/payments/paymentService.ts';
import type {
  PortOnePayment,
  PortOnePaymentClient
} from '../../../cloudrun-api/src/domains/payments/portoneClient.ts';

const FIXED_NOW = Date.parse('2026-07-21T00:00:00.000Z');
const ORDER_ID = 'UW-20260721-payment-contract-0001';
const PRODUCT_ID = 'general-signature';
const PRODUCT_PRICE = 79_000;
const ARCHIVED_ORDER_ID = 'UW-20260721-archived-contract-0001';
const ARCHIVED_PRODUCT_ID = 'life-flow';
const ARCHIVED_PRODUCT_PRICE = 59_000;
const ARCHIVED_TRANSACTION_ID = 'tx-archived-contract-fixture-0001';
const STORE_ID = 'store-contract-fixture';
const TRANSACTION_ID = 'tx-contract-fixture-0001';
const USER = { userId: 'kakao-contract-user-001' };
const OTHER_USER = { userId: 'kakao-contract-user-002' };

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
  lastListRequest: { userId: string; limit: number } | null = null;

  async createPaymentLedger(record: ConfirmedPaymentLedgerRecord) {
    if (this.records.has(record.entitlementId)) {
      throw new ReportRequestError(409, 'Firestore document already exists.');
    }

    this.records.set(record.entitlementId, { ...record });
  }

  async getPaymentLedger(entitlementId: string) {
    return this.records.get(entitlementId) || null;
  }

  async listPaymentLedgersByUserId(userId: string, limit: number) {
    this.lastListRequest = { userId, limit };
    return this.listRecords === undefined ? [...this.records.values()] : this.listRecords;
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
  const paymentService = new PaymentService({
    config: {
      storeId: STORE_ID,
      orderClaimTtlMs: config.report.orderClaimTtlMs,
      reportAccessTokenTtlMs: config.report.accessTokenTtlMs
    },
    portOneClient,
    ledgerRepository,
    tokenService,
    now: () => FIXED_NOW,
    randomBytes: (size) => Buffer.alloc(size, 7)
  });

  return {
    config,
    tokenService,
    portOneClient,
    ledgerRepository,
    paymentService
  };
}

function createOrder(harness: ReturnType<typeof createHarness>) {
  return harness.paymentService.createOrderIntent(USER, {
    orderId: ORDER_ID,
    productId: PRODUCT_ID
  });
}

function setPaidPayment(
  harness: ReturnType<typeof createHarness>,
  orderClaim: string
) {
  harness.portOneClient.payment = {
    id: ORDER_ID,
    status: 'PAID',
    storeId: STORE_ID,
    currency: 'KRW',
    amount: { total: PRODUCT_PRICE },
    transactionId: TRANSACTION_ID,
    customData: {
      productId: PRODUCT_ID,
      orderClaim
    },
    method: { type: 'CARD' },
    paidAt: '2026-07-21T00:00:01.000Z'
  };
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

function createLegacyArchivedOrderClaim(harness: ReturnType<typeof createHarness>) {
  return harness.tokenService.createPaymentOrderClaim({
    userId: USER.userId,
    orderId: ARCHIVED_ORDER_ID,
    productId: ARCHIVED_PRODUCT_ID,
    amount: ARCHIVED_PRODUCT_PRICE
  });
}

function setArchivedPaidPayment(
  harness: ReturnType<typeof createHarness>,
  orderClaim: string
) {
  harness.portOneClient.payment = {
    id: ARCHIVED_ORDER_ID,
    status: 'PAID',
    storeId: STORE_ID,
    currency: 'KRW',
    amount: { total: ARCHIVED_PRODUCT_PRICE },
    transactionId: ARCHIVED_TRANSACTION_ID,
    customData: {
      productId: ARCHIVED_PRODUCT_ID,
      orderClaim
    },
    method: { type: 'CARD' },
    paidAt: '2026-07-20T00:00:01.000Z'
  };
}

function archivedConfirmationBody(orderClaim: string) {
  return {
    paymentId: ARCHIVED_ORDER_ID,
    orderId: ARCHIVED_ORDER_ID,
    productId: ARCHIVED_PRODUCT_ID,
    amount: ARCHIVED_PRODUCT_PRICE,
    txId: ARCHIVED_TRANSACTION_ID,
    orderClaim
  };
}

async function confirmOnce(harness: ReturnType<typeof createHarness>) {
  const order = createOrder(harness);
  setPaidPayment(harness, order.orderClaim);
  return harness.paymentService.confirmPayment(USER, confirmationBody(order.orderClaim));
}

describe('Cloud Run payment contracts', () => {
  it('uses the server catalog price and binds the signed order claim to the user and order', () => {
    const harness = createHarness();
    const order = createOrder(harness);
    const claims = harness.tokenService.verifyPaymentOrderClaim(order.orderClaim, USER.userId);

    expect(order).toMatchObject({
      orderId: ORDER_ID,
      productId: PRODUCT_ID,
      amount: PRODUCT_PRICE,
      currency: 'KRW'
    });
    expect(Date.parse(order.orderClaimExpiresAt)).toBe(
      FIXED_NOW + harness.config.report.orderClaimTtlMs
    );
    expect(claims).toMatchObject({
      orderId: ORDER_ID,
      productId: PRODUCT_ID,
      amount: PRODUCT_PRICE,
      version: 1,
      userBinding: harness.tokenService.createUserBinding(USER.userId)
    });
    expect(() =>
      harness.paymentService.createOrderIntent(USER, {
        orderId: ORDER_ID,
        productId: PRODUCT_ID,
        amount: PRODUCT_PRICE - 1
      })
    ).toThrow('주문 금액이 서버 상품 가격과 일치하지 않습니다.');
  });

  it('confirms a matching PAID/KRW/store/product/orderClaim/transaction payment', async () => {
    const harness = createHarness();
    const order = createOrder(harness);
    setPaidPayment(harness, order.orderClaim);

    const confirmed = await harness.paymentService.confirmPayment(
      USER,
      confirmationBody(order.orderClaim)
    );
    const reportClaims = harness.tokenService.verifyReportAccessToken(
      confirmed.reportAccessToken
    );
    const entitlementId = createHash('sha256')
      .update(`portone:${ORDER_ID}`)
      .digest('hex');

    expect(harness.portOneClient.requestedPaymentIds).toEqual([ORDER_ID]);
    expect(confirmed).toMatchObject({
      paymentId: ORDER_ID,
      txId: TRANSACTION_ID,
      orderId: ORDER_ID,
      productId: PRODUCT_ID,
      amount: PRODUCT_PRICE,
      currency: 'KRW',
      status: 'PAID',
      method: 'CARD',
      approvedAt: '2026-07-21T00:00:01.000Z'
    });
    expect(reportClaims).toMatchObject({
      orderId: ORDER_ID,
      paymentId: ORDER_ID,
      productId: PRODUCT_ID,
      amount: PRODUCT_PRICE,
      entitlementId
    });
    expect(harness.ledgerRepository.records.get(entitlementId)).toMatchObject({
      paymentId: ORDER_ID,
      orderId: ORDER_ID,
      productId: PRODUCT_ID,
      amount: PRODUCT_PRICE,
      currency: 'KRW',
      storeId: STORE_ID,
      transactionId: TRANSACTION_ID,
      userId: USER.userId,
      entitlementStatus: 'active'
    });
  });

  it('confirms a legacy signed order claim for an archived catalog product', async () => {
    const harness = createHarness();
    const legacyOrderClaim = createLegacyArchivedOrderClaim(harness);
    setArchivedPaidPayment(harness, legacyOrderClaim);

    const confirmed = await harness.paymentService.confirmPayment(
      USER,
      archivedConfirmationBody(legacyOrderClaim)
    );
    const reportClaims = harness.tokenService.verifyReportAccessToken(
      confirmed.reportAccessToken
    );
    const entitlementId = createHash('sha256')
      .update(`portone:${ARCHIVED_ORDER_ID}`)
      .digest('hex');

    expect(harness.portOneClient.requestedPaymentIds).toEqual([ARCHIVED_ORDER_ID]);
    expect(confirmed).toMatchObject({
      paymentId: ARCHIVED_ORDER_ID,
      txId: ARCHIVED_TRANSACTION_ID,
      orderId: ARCHIVED_ORDER_ID,
      productId: ARCHIVED_PRODUCT_ID,
      amount: ARCHIVED_PRODUCT_PRICE,
      currency: 'KRW',
      status: 'PAID'
    });
    expect(reportClaims).toMatchObject({
      orderId: ARCHIVED_ORDER_ID,
      paymentId: ARCHIVED_ORDER_ID,
      productId: ARCHIVED_PRODUCT_ID,
      amount: ARCHIVED_PRODUCT_PRICE,
      entitlementId
    });
    expect(harness.ledgerRepository.records.get(entitlementId)).toMatchObject({
      productId: ARCHIVED_PRODUCT_ID,
      amount: ARCHIVED_PRODUCT_PRICE,
      entitlementStatus: 'active'
    });
  });

  it.each([
    ['status', (payment: Record<string, unknown>) => { payment.status = 'READY'; }],
    ['currency', (payment: Record<string, unknown>) => { payment.currency = 'USD'; }],
    ['store', (payment: Record<string, unknown>) => { payment.storeId = 'store-other'; }],
    ['product', (payment: Record<string, unknown>) => {
      payment.customData = { ...(payment.customData as object), productId: 'love-reading' };
    }],
    ['order claim', (payment: Record<string, unknown>) => {
      payment.customData = { ...(payment.customData as object), orderClaim: 'other-order-claim' };
    }],
    ['transaction', (_payment: Record<string, unknown>, body: Record<string, unknown>) => {
      body.txId = 'tx-other';
    }]
  ])('rejects a mismatched PortOne %s contract', async (_label, mutate) => {
    const harness = createHarness();
    const order = createOrder(harness);
    setPaidPayment(harness, order.orderClaim);
    const body: Record<string, unknown> = confirmationBody(order.orderClaim);
    mutate(harness.portOneClient.payment, body);

    await expect(harness.paymentService.confirmPayment(USER, body)).rejects.toMatchObject({
      status: 409
    });
  });

  it('accepts an identical duplicate ledger and issues a fresh report token', async () => {
    const harness = createHarness();
    const order = createOrder(harness);
    setPaidPayment(harness, order.orderClaim);
    const body = confirmationBody(order.orderClaim);

    const first = await harness.paymentService.confirmPayment(USER, body);
    const second = await harness.paymentService.confirmPayment(USER, body);
    const firstClaims = harness.tokenService.verifyReportAccessToken(first.reportAccessToken);
    const secondClaims = harness.tokenService.verifyReportAccessToken(second.reportAccessToken);

    expect(harness.ledgerRepository.records.size).toBe(1);
    expect(second.reportAccessToken).not.toBe(first.reportAccessToken);
    expect(secondClaims).toMatchObject({
      entitlementId: firstClaims.entitlementId,
      paymentId: firstClaims.paymentId,
      orderId: firstClaims.orderId,
      productId: firstClaims.productId,
      amount: firstClaims.amount
    });
  });

  it('rejects a duplicate when the existing ledger does not exactly match', async () => {
    const harness = createHarness();
    const first = await confirmOnce(harness);
    const claims = harness.tokenService.verifyReportAccessToken(first.reportAccessToken);
    const existing = harness.ledgerRepository.records.get(claims.entitlementId);

    harness.ledgerRepository.records.set(claims.entitlementId, {
      ...existing,
      transactionId: 'tampered-transaction'
    });

    await expect(confirmOnce(harness)).rejects.toMatchObject({
      status: 409,
      message: '이미 확인된 결제 원장과 현재 주문 정보가 일치하지 않습니다.'
    });
  });

  it('masks an entitlement owned by another account as not found', async () => {
    const harness = createHarness();
    await confirmOnce(harness);

    await expect(
      harness.paymentService.renewEntitlement(OTHER_USER, { orderId: ORDER_ID })
    ).rejects.toMatchObject({
      status: 404,
      message: '이 계정에서 복구할 수 있는 결제 권한을 찾지 못했습니다.'
    });
  });

  it('renews an active entitlement backed by an archived catalog product', async () => {
    const harness = createHarness();
    const entitlementId = createHash('sha256')
      .update(`portone:${ARCHIVED_ORDER_ID}`)
      .digest('hex');

    harness.ledgerRepository.records.set(entitlementId, {
      paymentId: ARCHIVED_ORDER_ID,
      orderId: ARCHIVED_ORDER_ID,
      productId: ARCHIVED_PRODUCT_ID,
      amount: ARCHIVED_PRODUCT_PRICE,
      currency: 'KRW',
      userId: USER.userId,
      userBinding: harness.tokenService.createUserBinding(USER.userId),
      entitlementId,
      entitlementStatus: 'active'
    });

    const renewed = await harness.paymentService.renewEntitlement(USER, {
      orderId: ARCHIVED_ORDER_ID
    });
    const reportClaims = harness.tokenService.verifyReportAccessToken(
      renewed.reportAccessToken
    );

    expect(renewed).toMatchObject({
      orderId: ARCHIVED_ORDER_ID,
      productId: ARCHIVED_PRODUCT_ID,
      amount: ARCHIVED_PRODUCT_PRICE,
      currency: 'KRW'
    });
    expect(reportClaims).toMatchObject({
      orderId: ARCHIVED_ORDER_ID,
      paymentId: ARCHIVED_ORDER_ID,
      productId: ARCHIVED_PRODUCT_ID,
      amount: ARCHIVED_PRODUCT_PRICE,
      entitlementId
    });
  });

  it('lists active entitlements for active and archived catalog products while excluding unknown products', async () => {
    const harness = createHarness();
    const binding = harness.tokenService.createUserBinding(USER.userId);
    const base = {
      userId: USER.userId,
      userBinding: binding,
      entitlementStatus: 'active',
      currency: 'KRW'
    };

    harness.ledgerRepository.listRecords = [
      {
        ...base,
        orderId: 'UW-list-valid-older-0001',
        productId: 'general-signature',
        amount: 79_000,
        confirmedAt: '2026-07-20T10:00:00.000Z'
      },
      {
        ...base,
        orderId: 'UW-list-valid-newer-0002',
        productId: 'love-reading',
        amount: 49_000,
        confirmedAt: '2026-07-21T10:00:00.000Z'
      },
      {
        ...base,
        orderId: 'UW-list-archived-newest-0008',
        productId: ARCHIVED_PRODUCT_ID,
        amount: ARCHIVED_PRODUCT_PRICE,
        confirmedAt: '2026-07-22T10:00:00.000Z'
      },
      {
        ...base,
        userId: OTHER_USER.userId,
        orderId: 'UW-list-other-user-0003',
        productId: 'general-signature',
        amount: 79_000,
        confirmedAt: '2026-07-22T10:00:00.000Z'
      },
      {
        ...base,
        userBinding: 'wrong-binding',
        orderId: 'UW-list-wrong-binding-0004',
        productId: 'general-signature',
        amount: 79_000,
        confirmedAt: '2026-07-22T10:00:00.000Z'
      },
      {
        ...base,
        entitlementStatus: 'revoked',
        orderId: 'UW-list-inactive-0005',
        productId: 'general-signature',
        amount: 79_000,
        confirmedAt: '2026-07-22T10:00:00.000Z'
      },
      {
        ...base,
        orderId: 'UW-list-wrong-price-0006',
        productId: 'general-signature',
        amount: 1,
        confirmedAt: '2026-07-22T10:00:00.000Z'
      },
      {
        ...base,
        orderId: 'UW-list-unknown-product-0007',
        productId: 'unknown-product',
        amount: 79_000,
        confirmedAt: '2026-07-22T10:00:00.000Z'
      }
    ];

    const entitlements = await harness.paymentService.queryEntitlements(USER);

    expect(harness.ledgerRepository.lastListRequest).toEqual({
      userId: USER.userId,
      limit: 100
    });
    expect(entitlements).toEqual([
      {
        orderId: 'UW-list-archived-newest-0008',
        productId: ARCHIVED_PRODUCT_ID,
        amount: ARCHIVED_PRODUCT_PRICE,
        currency: 'KRW',
        confirmedAt: '2026-07-22T10:00:00.000Z',
        status: 'active'
      },
      {
        orderId: 'UW-list-valid-newer-0002',
        productId: 'love-reading',
        amount: 49_000,
        currency: 'KRW',
        confirmedAt: '2026-07-21T10:00:00.000Z',
        status: 'active'
      },
      {
        orderId: 'UW-list-valid-older-0001',
        productId: 'general-signature',
        amount: 79_000,
        currency: 'KRW',
        confirmedAt: '2026-07-20T10:00:00.000Z',
        status: 'active'
      }
    ]);
  });
});
