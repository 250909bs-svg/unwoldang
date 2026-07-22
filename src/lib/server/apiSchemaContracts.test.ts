import { describe, expect, it } from 'vitest';
import {
  API_ERROR_CODE
} from '../../../cloudrun-api/src/contracts/api.ts';
import {
  ApiSchemaError,
  assertApiErrorResponse,
  isAdminDataResponse,
  isAdminLoginResponse,
  isApiErrorResponse,
  isConfirmPaymentResponse,
  isCreateOrderResponse,
  isEntitlementListResponse,
  isGenerateReportResponse,
  isKakaoExchangeResponse,
  isRenewEntitlementResponse,
  isReportArchiveListResponse,
  isSaveReportArchiveResponse,
  parseAdminLoginRequest,
  parseConfirmPaymentRequest,
  parseCreateOrderRequest,
  parseGenerateReportRequest,
  parseKakaoExchangeRequest,
  parseRenewEntitlementRequest,
  parseSaveReportArchiveRequest
} from '../../../cloudrun-api/src/contracts/apiSchemas.ts';
import {
  SERVER_PRODUCT_CATALOG,
  type ServerProductCatalog
} from '../../../cloudrun-api/src/contracts/products.ts';

const ACTIVE_PRODUCT_ID = 'general-signature' as const;
const ACTIVE_AMOUNT = 79_000;
const ARCHIVED_PRODUCT_ID = 'life-flow' as const;
const ARCHIVED_AMOUNT = 59_000;
const ORDER_ID = 'UW-20260722-schema-contract-0001';
const ARCHIVED_ORDER_ID = 'UW-20260722-archive-contract-0001';
const TOKEN = 't'.repeat(48);
const CLAIM = 'c'.repeat(48);
const EXPIRES_AT = '2026-07-22T01:00:00.000Z';

const draftCatalog: ServerProductCatalog = {
  ...SERVER_PRODUCT_CATALOG,
  [ACTIVE_PRODUCT_ID]: {
    ...SERVER_PRODUCT_CATALOG[ACTIVE_PRODUCT_ID],
    status: 'draft'
  }
};

describe('API request runtime schemas', () => {
  it('parses Kakao, active order and admin compatibility requests', () => {
    expect(parseKakaoExchangeRequest({
      code: ' kakao-code ',
      redirectUri: 'https://www.unwoldang.com/auth/kakao/callback'
    })).toEqual({
      code: 'kakao-code',
      redirectUri: 'https://www.unwoldang.com/auth/kakao/callback'
    });

    expect(parseCreateOrderRequest({
      productId: ACTIVE_PRODUCT_ID,
      amount: ACTIVE_AMOUNT,
      orderId: ORDER_ID,
      ignoredLegacyField: true
    })).toEqual({
      productId: ACTIVE_PRODUCT_ID,
      amount: ACTIVE_AMOUNT,
      orderId: ORDER_ID
    });

    expect(parseAdminLoginRequest({ adminId: ' operator ', password: 'secret' })).toEqual({
      adminId: 'operator',
      password: 'secret'
    });
  });

  it('preserves optional confirmation and report compatibility fields', () => {
    expect(parseConfirmPaymentRequest({
      paymentId: ARCHIVED_ORDER_ID,
      orderId: ARCHIVED_ORDER_ID,
      productId: ARCHIVED_PRODUCT_ID,
      amount: ARCHIVED_AMOUNT
    })).toEqual({
      paymentId: ARCHIVED_ORDER_ID,
      orderId: ARCHIVED_ORDER_ID,
      productId: ARCHIVED_PRODUCT_ID,
      amount: ARCHIVED_AMOUNT
    });

    expect(parseConfirmPaymentRequest({
      paymentId: ORDER_ID,
      orderId: ORDER_ID,
      productId: ACTIVE_PRODUCT_ID,
      amount: ACTIVE_AMOUNT,
      txId: ' tx-1 ',
      orderClaim: CLAIM
    })).toMatchObject({ txId: 'tx-1', orderClaim: CLAIM });

    expect(parseGenerateReportRequest({
      serviceId: ACTIVE_PRODUCT_ID,
      payload: { formData: { name: 'fixture-user' } },
      reportMode: 'premium-v2',
      promptVersion: 'v2',
      orderId: ORDER_ID,
      reportAccessToken: TOKEN,
      ignoredLegacyField: 'preserved-by-caller-only'
    })).toEqual({
      serviceId: ACTIVE_PRODUCT_ID,
      payload: { formData: { name: 'fixture-user' } },
      reportMode: 'premium-v2',
      promptVersion: 'v2',
      orderId: ORDER_ID,
      reportAccessToken: TOKEN
    });
  });

  it('accepts archived entitlement renewal and legacy archive entry IDs', () => {
    expect(parseRenewEntitlementRequest({ orderId: ARCHIVED_ORDER_ID })).toEqual({
      orderId: ARCHIVED_ORDER_ID
    });

    const parsed = parseSaveReportArchiveRequest({
      entry: {
        id: `${ARCHIVED_PRODUCT_ID}:${ARCHIVED_ORDER_ID}`,
        orderId: ARCHIVED_ORDER_ID,
        productId: ARCHIVED_PRODUCT_ID,
        title: 'legacy-compatible-title',
        reportData: { serviceId: ARCHIVED_PRODUCT_ID },
        ignoredLegacyField: 'must-not-cross-the-api-boundary'
      },
      reportAccessToken: TOKEN
    });

    expect(parsed).toMatchObject({
      entry: {
        id: `${ARCHIVED_PRODUCT_ID}:${ARCHIVED_ORDER_ID}`,
        orderId: ARCHIVED_ORDER_ID,
        productId: ARCHIVED_PRODUCT_ID,
        title: 'legacy-compatible-title'
      },
      reportAccessToken: TOKEN
    });
    expect(parsed.entry).not.toHaveProperty('ignoredLegacyField');
  });

  it('rejects unknown, archived-for-new-order and draft products', () => {
    expect(() => parseCreateOrderRequest({ productId: 'unknown-product' })).toThrow(
      ApiSchemaError
    );
    expect(() => parseGenerateReportRequest({
      serviceId: 'unknown-product',
      payload: {}
    })).toThrow('not registered');
    expect(() => parseCreateOrderRequest({ productId: ARCHIVED_PRODUCT_ID })).toThrow(
      ApiSchemaError
    );
    expect(() => parseCreateOrderRequest(
      { productId: ACTIVE_PRODUCT_ID },
      { catalog: draftCatalog }
    )).toThrow(ApiSchemaError);
    expect(() => parseGenerateReportRequest(
      { serviceId: ACTIVE_PRODUCT_ID, payload: {} },
      { catalog: draftCatalog }
    )).toThrow(ApiSchemaError);
    expect(() => parseSaveReportArchiveRequest(
      {
        entry: {
          id: `${ACTIVE_PRODUCT_ID}:${ORDER_ID}`,
          orderId: ORDER_ID,
          productId: ACTIVE_PRODUCT_ID,
          reportData: {}
        },
        reportAccessToken: TOKEN
      },
      { catalog: draftCatalog }
    )).toThrow(ApiSchemaError);
  });

  it('rejects malformed scalar, envelope and binding fields', () => {
    expect(() => parseKakaoExchangeRequest({
      code: '',
      redirectUri: 'javascript:alert(1)'
    })).toThrow(ApiSchemaError);
    expect(() => parseCreateOrderRequest({
      productId: ACTIVE_PRODUCT_ID,
      amount: 1.5
    })).toThrow(ApiSchemaError);
    expect(() => parseConfirmPaymentRequest({
      paymentId: ORDER_ID,
      orderId: ARCHIVED_ORDER_ID,
      productId: ACTIVE_PRODUCT_ID,
      amount: ACTIVE_AMOUNT
    })).toThrow('must match');
    expect(() => parseRenewEntitlementRequest({ orderId: 'UW-short' })).toThrow(
      ApiSchemaError
    );
    expect(() => parseGenerateReportRequest({
      serviceId: ACTIVE_PRODUCT_ID,
      payload: []
    })).toThrow(ApiSchemaError);
    expect(() => parseSaveReportArchiveRequest({
      entry: {
        id: `${ACTIVE_PRODUCT_ID}:${ORDER_ID}`,
        productId: ACTIVE_PRODUCT_ID
      },
      reportAccessToken: TOKEN
    })).toThrow(ApiSchemaError);
    expect(() => parseAdminLoginRequest({ adminId: 'operator', password: '   ' })).toThrow(
      ApiSchemaError
    );
    expect(() => parseSaveReportArchiveRequest({
      entry: {
        id: `${ACTIVE_PRODUCT_ID}:${ORDER_ID}`,
        orderId: ORDER_ID,
        productId: ACTIVE_PRODUCT_ID,
        reportData: {
          reportAccessToken: 'must-never-be-stored'
        }
      },
      reportAccessToken: TOKEN
    })).toThrow(ApiSchemaError);
  });
});

describe('API response runtime guards', () => {
  const createOrderResponse = {
    orderId: ORDER_ID,
    productId: ACTIVE_PRODUCT_ID,
    amount: ACTIVE_AMOUNT,
    currency: 'KRW',
    orderClaim: CLAIM,
    orderClaimExpiresAt: EXPIRES_AT
  };

  const confirmResponse = {
    paymentId: ARCHIVED_ORDER_ID,
    txId: 'tx-archived-1',
    orderId: ARCHIVED_ORDER_ID,
    productId: ARCHIVED_PRODUCT_ID,
    amount: ARCHIVED_AMOUNT,
    currency: 'KRW',
    status: 'PAID',
    method: 'CARD',
    approvedAt: '2026-07-22T00:00:00.000Z',
    reportAccessToken: TOKEN,
    reportAccessTokenExpiresAt: EXPIRES_AT
  };

  const renewedResponse = {
    orderId: ARCHIVED_ORDER_ID,
    productId: ARCHIVED_PRODUCT_ID,
    amount: ARCHIVED_AMOUNT,
    currency: 'KRW',
    reportAccessToken: TOKEN,
    reportAccessTokenExpiresAt: EXPIRES_AT
  };

  it('accepts current and optional legacy success response shapes', () => {
    expect(isKakaoExchangeResponse({
      user: { id: 'kakao-user-1', nickname: 'fixture-user' },
      provider: 'kakao',
      authToken: TOKEN,
      connectedAt: '2026-07-22T00:00:00.000Z'
    })).toBe(true);
    expect(isCreateOrderResponse(createOrderResponse)).toBe(true);
    expect(isConfirmPaymentResponse(confirmResponse)).toBe(true);
    expect(isRenewEntitlementResponse(renewedResponse)).toBe(true);
    expect(isEntitlementListResponse({
      entitlements: [{
        orderId: ARCHIVED_ORDER_ID,
        productId: ARCHIVED_PRODUCT_ID,
        amount: ARCHIVED_AMOUNT,
        currency: 'KRW',
        status: 'active',
        confirmedAt: '2026-07-22T00:00:00.000Z'
      }]
    })).toBe(true);
    expect(isGenerateReportResponse({ provider: 'deterministic-fallback', report: {} })).toBe(true);
    expect(isSaveReportArchiveResponse({ ok: true, entry: { id: 'archive-1' } })).toBe(true);
    expect(isReportArchiveListResponse({ entries: [{ id: 'archive-1' }] })).toBe(true);
    expect(isReportArchiveListResponse({
      entries: [{ id: 'archive-1' }],
      storage: 'firestore'
    })).toBe(true);
    expect(isAdminLoginResponse({ adminAccessToken: TOKEN })).toBe(true);
    expect(isAdminLoginResponse({ adminAccessToken: TOKEN, expiresInMs: 43_200_000 })).toBe(true);
    expect(isAdminDataResponse({ entries: [], storage: 'firestore' })).toBe(true);
  });

  it('rejects response product, price, status, token and envelope mismatches', () => {
    expect(isCreateOrderResponse({ ...createOrderResponse, productId: 'unknown-product' })).toBe(false);
    expect(isCreateOrderResponse({ ...createOrderResponse, amount: 1 })).toBe(false);
    expect(isConfirmPaymentResponse({ ...confirmResponse, status: 'FAILED' })).toBe(false);
    expect(isConfirmPaymentResponse({ ...confirmResponse, paymentId: ORDER_ID })).toBe(false);
    expect(isRenewEntitlementResponse({ ...renewedResponse, reportAccessToken: 'short' })).toBe(false);
    expect(isEntitlementListResponse({ entitlements: [{ productId: 'unknown-product' }] })).toBe(false);
    expect(isEntitlementListResponse({
      entitlements: [{
        orderId: ARCHIVED_ORDER_ID,
        productId: ARCHIVED_PRODUCT_ID,
        amount: ARCHIVED_AMOUNT,
        currency: 'KRW',
        status: 'revoked',
        confirmedAt: '2026-07-22T00:00:00.000Z'
      }]
    })).toBe(false);
    expect(isReportArchiveListResponse({ entries: null, storage: 'firestore' })).toBe(false);
    expect(isAdminLoginResponse({ adminAccessToken: TOKEN, expiresInMs: -1 })).toBe(false);
  });

  it('accepts only the safe public API error envelope', () => {
    const safeError = {
      code: API_ERROR_CODE.REPORT_GENERATION_IN_PROGRESS,
      message: 'The report is still being prepared.',
      retryAfterSeconds: 3
    };

    expect(isApiErrorResponse(safeError)).toBe(true);
    expect(() => assertApiErrorResponse(safeError)).not.toThrow();
    expect(isApiErrorResponse({
      ...safeError,
      stack: 'internal stack must never be public'
    })).toBe(false);
    expect(isApiErrorResponse({
      ...safeError,
      cause: { providerMessage: 'raw provider failure' }
    })).toBe(false);
    expect(isApiErrorResponse({ code: 'UNKNOWN_CODE', message: 'unsafe' })).toBe(false);
    expect(isApiErrorResponse({
      code: API_ERROR_CODE.INTERNAL_ERROR,
      message: 'A safe internal error occurred.',
      retryAfterSeconds: 0
    })).toBe(false);
    expect(() => assertApiErrorResponse({
      code: API_ERROR_CODE.INTERNAL_ERROR,
      message: 'safe',
      details: 'raw internal details'
    })).toThrow('unsafe API error');
  });
});
