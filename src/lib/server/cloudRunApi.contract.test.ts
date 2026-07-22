import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  createApp,
  type CreateAppOptions
} from '../../../cloudrun-api/src/app.ts';
import { loadConfig } from '../../../cloudrun-api/src/config/env.ts';
import { API_ERROR_CODE } from '../../../cloudrun-api/src/contracts/api.ts';
import {
  PRODUCT_STATUS,
  SERVER_PRODUCT_CATALOG
} from '../../../cloudrun-api/src/contracts/products.ts';
import { TokenService } from '../../../cloudrun-api/src/domains/auth/tokenService.ts';
import { PUBLIC_ROUTES } from '../../../cloudrun-api/src/http/router.ts';

const ALLOWED_ORIGIN = 'https://contract.example';

const EXPECTED_PUBLIC_ROUTES = [
  'GET /health',
  'POST /api/report',
  'POST /report',
  'POST /api/payments/portone/order',
  'POST /api/payments/portone/confirm',
  'GET /api/payments/portone/entitlements',
  'POST /api/payments/portone/entitlement/renew',
  'POST /api/auth/kakao/exchange',
  'GET /api/archive/reports',
  'POST /api/archive/reports',
  'POST /api/admin/login',
  'GET /api/admin/reports'
] as const;

const productionConfig = loadConfig({
  NODE_ENV: 'production',
  ALLOWED_ORIGINS: ALLOWED_ORIGIN,
  REPORT_ACCESS_SECRET: 'fixture-report-access-secret',
  USER_ACCESS_SECRET: 'fixture-user-access-secret',
  ADMIN_ACCESS_SECRET: 'fixture-admin-access-secret',
  ENABLE_FIRESTORE_ARCHIVE: 'true',
  FIRESTORE_PROJECT_ID: 'fixture-firestore-project',
  PORTONE_API_SECRET: 'fixture-portone-api-secret',
  PORTONE_STORE_ID: 'fixture-portone-store',
  GEMINI_MODEL: 'fixture-gemini-model',
  REPORT_RATE_LIMIT_MAX: '100'
});

const unexpectedExternalFetch = vi.fn(async () => {
  throw new Error('Contract tests must not make external requests.');
});

const productionReportGenerator = vi.fn(async () => ({
  provider: 'fixture-report-generator'
}));

let productionServer: Server;
let productionBaseUrl: string;

async function startApp(options: CreateAppOptions) {
  const server = createServer(createApp(options));

  await new Promise<void>((resolve, reject) => {
    const handleError = (error: Error) => reject(error);
    server.once('error', handleError);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', handleError);
      resolve();
    });
  });

  const address = server.address();

  if (!address || typeof address === 'string') {
    await closeServer(server);
    throw new Error('Expected the contract server to expose a TCP address.');
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`
  };
}

async function closeServer(server: Server) {
  if (!server.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, any>;
}

beforeAll(async () => {
  const running = await startApp({
    config: productionConfig,
    fetchImplementation: unexpectedExternalFetch as unknown as typeof fetch,
    reportGenerator: productionReportGenerator as unknown as CreateAppOptions['reportGenerator']
  });
  productionServer = running.server;
  productionBaseUrl = running.baseUrl;
});

afterAll(async () => {
  await closeServer(productionServer);
  expect(unexpectedExternalFetch).not.toHaveBeenCalled();
});

describe('Cloud Run API HTTP contracts', () => {
  it('returns the exact health readiness shape with security and no-store headers', async () => {
    const response = await fetch(`${productionBaseUrl}/health`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      service: 'unwoldang-cloudrun-api',
      provider: 'gemini',
      providerConfigured: false,
      readyForAiEnhancement: false,
      readyForReportGeneration: true,
      readyForPaymentConfirmation: true,
      model: 'fixture-gemini-model',
      timestamp: expect.any(String)
    });
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('permissions-policy')).toBe(
      'camera=(), microphone=(), geolocation=()'
    );
    expect(response.headers.get('content-security-policy')).toBe(
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    );
  });

  it('allows configured CORS origins and answers preflight with 204', async () => {
    const corsResponse = await fetch(`${productionBaseUrl}/health`, {
      headers: { Origin: ALLOWED_ORIGIN }
    });

    expect(corsResponse.status).toBe(200);
    expect(corsResponse.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    expect(corsResponse.headers.get('vary')).toBe('Origin');
    expect(corsResponse.headers.get('access-control-allow-methods')).toBe(
      'GET,POST,OPTIONS'
    );
    expect(corsResponse.headers.get('access-control-allow-headers')).toBe(
      'Content-Type, Authorization'
    );

    const preflight = await fetch(`${productionBaseUrl}/api/report`, {
      method: 'OPTIONS',
      headers: {
        Origin: ALLOWED_ORIGIN,
        'Access-Control-Request-Method': 'POST'
      }
    });

    expect(preflight.status).toBe(204);
    expect(await preflight.text()).toBe('');
    expect(preflight.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    expect(preflight.headers.get('access-control-allow-methods')).toBe(
      'GET,POST,OPTIONS'
    );
  });

  it('returns the exact 404 contract and advertised public routes', async () => {
    const response = await fetch(`${productionBaseUrl}/not-a-route`);
    const body = await readJson(response);

    expect(PUBLIC_ROUTES).toEqual(EXPECTED_PUBLIC_ROUTES);
    expect(response.status).toBe(404);
    expect(body).toEqual({
      code: API_ERROR_CODE.UNSUPPORTED_ROUTE,
      message: '지원하지 않는 경로입니다.',
      routes: [...EXPECTED_PUBLIC_ROUTES]
    });
  });

  it('preserves every bare and /api alias with the same authentication boundary', async () => {
    const cases = [
      {
        method: 'POST',
        paths: ['/report', '/api/report'],
        status: 401,
        message: 'Report access token is required.'
      },
      {
        method: 'POST',
        paths: ['/payments/portone/order', '/api/payments/portone/order'],
        status: 401,
        message: 'Login access token is required.'
      },
      {
        method: 'POST',
        paths: ['/payments/portone/confirm', '/api/payments/portone/confirm'],
        status: 401,
        message: 'Login access token is required.'
      },
      {
        method: 'GET',
        paths: [
          '/payments/portone/entitlements',
          '/api/payments/portone/entitlements'
        ],
        status: 401,
        message: 'Login access token is required.'
      },
      {
        method: 'POST',
        paths: [
          '/payments/portone/entitlement/renew',
          '/api/payments/portone/entitlement/renew'
        ],
        status: 401,
        message: 'Login access token is required.'
      },
      {
        method: 'POST',
        paths: ['/auth/kakao/exchange', '/api/auth/kakao/exchange'],
        status: 500,
        message: '카카오 REST API 키가 서버에 설정되지 않았습니다.'
      },
      {
        method: 'GET',
        paths: ['/archive/reports', '/api/archive/reports'],
        status: 401,
        message: 'Login access token is required.'
      },
      {
        method: 'POST',
        paths: ['/archive/reports', '/api/archive/reports'],
        status: 401,
        message: 'Login access token is required.'
      },
      {
        method: 'POST',
        paths: ['/admin/login', '/api/admin/login'],
        status: 503,
        message: 'ADMIN_CREDENTIAL_HASH is not configured.'
      },
      {
        method: 'GET',
        paths: ['/admin/reports', '/api/admin/reports'],
        status: 401,
        message: 'Admin access token is required.'
      }
    ] as const;

    const expectedCodeByStatus = {
      401: API_ERROR_CODE.AUTH_REQUIRED,
      500: API_ERROR_CODE.INTERNAL_ERROR,
      503: API_ERROR_CODE.SERVICE_UNAVAILABLE
    } as const;

    for (const contract of cases) {
      for (const path of contract.paths) {
        const isPost = contract.method === 'POST';
        const response = await fetch(`${productionBaseUrl}${path}`, {
          method: contract.method,
          headers: isPost ? { 'Content-Type': 'application/json' } : undefined,
          body: isPost ? '{}' : undefined
        });

        expect(response.status).toBe(contract.status);
        expect(await readJson(response)).toEqual({
          code: expectedCodeByStatus[contract.status],
          message:
            contract.status >= 500
              ? '요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.'
              : contract.message
        });
      }
    }
  });

  it('rejects malformed JSON before route-specific processing', async () => {
    const response = await fetch(`${productionBaseUrl}/api/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{'
    });

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({
      code: API_ERROR_CODE.REQUEST_INVALID,
      message: 'JSON 본문 형식이 올바르지 않습니다.'
    });
  });

  it('allows a development unverified report and rate-limits the next request', async () => {
    const reportGenerator = vi.fn(async (body: Record<string, unknown>) => ({
      provider: 'fixture-report-generator',
      received: body
    }));
    const developmentConfig = loadConfig({
      NODE_ENV: 'development',
      ALLOW_UNVERIFIED_REPORTS: 'true',
      REPORT_RATE_LIMIT_MAX: '1',
      REPORT_RATE_LIMIT_WINDOW_MS: '60000'
    });
    const running = await startApp({
      config: developmentConfig,
      fetchImplementation: unexpectedExternalFetch as unknown as typeof fetch,
      reportGenerator: reportGenerator as unknown as CreateAppOptions['reportGenerator']
    });
    const requestBody = {
      serviceId: 'general-signature',
      payload: { fixture: true },
      orderId: 'removed-before-generation',
      reportAccessToken: 'removed-before-generation'
    };

    try {
      const success = await fetch(`${running.baseUrl}/api/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      expect(success.status).toBe(200);
      expect(await readJson(success)).toEqual({
        provider: 'fixture-report-generator',
        received: {
          serviceId: 'general-signature',
          payload: { fixture: true }
        }
      });
      expect(reportGenerator).toHaveBeenCalledTimes(1);
      expect(reportGenerator).toHaveBeenCalledWith({
        serviceId: 'general-signature',
        payload: { fixture: true }
      });

      const limited = await fetch(`${running.baseUrl}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      expect(limited.status).toBe(429);
      expect(await readJson(limited)).toEqual({
        code: API_ERROR_CODE.RATE_LIMITED,
        message: 'AI report request limit exceeded. Please try again shortly.'
      });
      expect(reportGenerator).toHaveBeenCalledTimes(1);
    } finally {
      await closeServer(running.server);
    }
  });

  it('keeps the exact twelve-product server catalog and sale status contract', () => {
    expect(SERVER_PRODUCT_CATALOG).toEqual({
      'general-signature': { amount: 79_000, currency: 'KRW', status: 'active' },
      'life-flow': { amount: 59_000, currency: 'KRW', status: 'archived' },
      'concern-reading': { amount: 2_900, currency: 'KRW', status: 'archived' },
      'past-life-goblin': { amount: 49_000, currency: 'KRW', status: 'active' },
      'love-reading': { amount: 49_000, currency: 'KRW', status: 'active' },
      'love-reunion': { amount: 55_000, currency: 'KRW', status: 'active' },
      'match-couple': { amount: 69_000, currency: 'KRW', status: 'active' },
      'match-destiny': { amount: 63_000, currency: 'KRW', status: 'archived' },
      'marriage-blueprint': { amount: 72_000, currency: 'KRW', status: 'archived' },
      'marriage-timing': { amount: 58_000, currency: 'KRW', status: 'archived' },
      'career-reading': { amount: 59_000, currency: 'KRW', status: 'archived' },
      'money-reading': { amount: 59_000, currency: 'KRW', status: 'archived' }
    });
    expect(Object.keys(SERVER_PRODUCT_CATALOG)).toHaveLength(12);
    expect(PRODUCT_STATUS.ACTIVE).toBe('active');
    expect(PRODUCT_STATUS.ARCHIVED).toBe('archived');

    for (const productId of [
      'general-signature',
      'past-life-goblin',
      'love-reading',
      'love-reunion',
      'match-couple'
    ] as const) {
      expect(SERVER_PRODUCT_CATALOG).toHaveProperty(productId);
    }
  });

  it('returns 409 for archived products and 400 for unknown products on new orders', async () => {
    const tokens = new TokenService(productionConfig);
    const userToken = tokens.createUserAccessToken({
      id: 'fixture-product-policy-user',
      nickname: 'Fixture Product Policy User'
    });
    const cases = [
      {
        productId: 'life-flow',
        status: 409,
        code: API_ERROR_CODE.STATE_CONFLICT,
        message: '현재 신규 판매 중인 상품이 아닙니다.'
      },
      {
        productId: 'unknown-product',
        status: 400,
        code: API_ERROR_CODE.REQUEST_INVALID,
        message: '서버 상품표에서 확인할 수 없는 productId입니다.'
      }
    ] as const;

    for (const contract of cases) {
      const response = await fetch(`${productionBaseUrl}/api/payments/portone/order`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ productId: contract.productId })
      });

      expect(response.status).toBe(contract.status);
      expect(await readJson(response)).toEqual({
        code: contract.code,
        message: contract.message
      });
    }
  });

  it('isolates token purposes and accepts a valid user token only at the order boundary', async () => {
    const tokens = new TokenService(productionConfig);
    const firstBinding = tokens.createUserBinding('fixture-user');

    expect(firstBinding).toBe(tokens.createUserBinding('fixture-user'));
    expect(firstBinding).not.toBe(tokens.createUserBinding('different-user'));

    const userToken = tokens.createUserAccessToken({
      id: 'fixture-user',
      nickname: 'Fixture User',
      email: 'fixture@example.invalid'
    });

    expect(tokens.verifyUserAccessToken(userToken)).toEqual({
      userId: 'fixture-user',
      nickname: 'Fixture User',
      email: 'fixture@example.invalid'
    });
    expect(() => tokens.verifySignedAccessToken(userToken, 'order')).toThrow(
      'Invalid access token.'
    );

    const orderResponse = await fetch(`${productionBaseUrl}/api/payments/portone/order`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ productId: 'general-signature' })
    });
    const order = await readJson(orderResponse);

    expect(orderResponse.status).toBe(200);
    expect(order).toEqual({
      orderId: expect.stringMatching(/^UW-[A-Za-z0-9._-]{12,116}$/),
      productId: 'general-signature',
      amount: 79_000,
      currency: 'KRW',
      orderClaim: expect.any(String),
      orderClaimExpiresAt: expect.any(String)
    });
    expect(tokens.verifyPaymentOrderClaim(order.orderClaim, 'fixture-user')).toMatchObject({
      orderId: order.orderId,
      productId: 'general-signature',
      amount: 79_000,
      userBinding: firstBinding,
      version: 1
    });
    expect(() => tokens.verifyReportAccessToken(order.orderClaim)).toThrow(
      'Invalid access token.'
    );

    const mismatch = await fetch(`${productionBaseUrl}/payments/portone/order`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        productId: 'general-signature',
        amount: 1
      })
    });

    expect(mismatch.status).toBe(409);
    expect(await readJson(mismatch)).toEqual({
      code: API_ERROR_CODE.STATE_CONFLICT,
      message: '주문 금액이 서버 상품 가격과 일치하지 않습니다.'
    });
  });
});
