import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  createApp,
  type CreateAppOptions
} from '../../../cloudrun-api/src/app.ts';
import { loadConfig } from '../../../cloudrun-api/src/config/env.ts';
import {
  PUBLIC_ERROR_CODES,
  PUBLIC_ERROR_MESSAGES,
  ReportGenerationInProgressError,
  type PublicErrorCode
} from '../../../cloudrun-api/src/contracts/errors.ts';
import {
  PRODUCT_STATUS,
  SERVER_PRODUCT_CATALOG
} from '../../../cloudrun-api/src/contracts/products.ts';
import { TokenService } from '../../../cloudrun-api/src/domains/auth/tokenService.ts';
import { PUBLIC_ROUTES } from '../../../cloudrun-api/src/http/router.ts';
import type {
  StructuredLogger,
  StructuredLogRecord
} from '../../../cloudrun-api/src/observability/logger.ts';
import { hashOrderId } from '../../../cloudrun-api/src/observability/requestContext.ts';

const ALLOWED_ORIGIN = 'https://contract.example';
const FIXED_REQUEST_ID = '629aa0b8-01aa-4c4b-a66c-53fb6cbd37ea';
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NOOP_LOGGER: StructuredLogger = { log() {} };

const EXPECTED_PUBLIC_ROUTES = [
  'GET /health',
  'GET /health/live',
  'GET /health/ready',
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
  const server = createServer(
    createApp({
      ...options,
      logger: options.logger || NOOP_LOGGER
    })
  );

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

function expectRequestId(response: Response) {
  const requestId = response.headers.get('x-request-id');
  expect(requestId).toMatch(REQUEST_ID_PATTERN);
  return requestId as string;
}

async function expectPublicError(
  response: Response,
  status: number,
  errorCode: PublicErrorCode,
  extra: Record<string, unknown> = {}
) {
  const requestId = expectRequestId(response);
  const body = await readJson(response);

  expect(response.status).toBe(status);
  expect(body).toEqual({
    errorCode,
    message: PUBLIC_ERROR_MESSAGES[errorCode],
    requestId,
    ...extra
  });
  return body;
}

async function expectRateLimited(response: Response) {
  const requestId = expectRequestId(response);
  const body = await readJson(response);

  expect(response.status).toBe(429);
  expect(body).toEqual({
    errorCode: PUBLIC_ERROR_CODES.RATE_LIMIT_EXCEEDED,
    message: PUBLIC_ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
    requestId,
    retryAfterSeconds: expect.any(Number)
  });
  expect(response.headers.get('retry-after')).toBe(String(body.retryAfterSeconds));
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
  it('separates summary, liveness, and readiness without exposing dependency details', async () => {
    const summaryResponse = await fetch(`${productionBaseUrl}/health`);
    const summary = await readJson(summaryResponse);

    expect(summaryResponse.status).toBe(200);
    expectRequestId(summaryResponse);
    expect(summary).toEqual({
      ok: true,
      service: 'unwoldang-cloudrun-api',
      status: 'degraded',
      timestamp: expect.any(String)
    });
    expect(Number.isNaN(Date.parse(summary.timestamp))).toBe(false);
    expect(summary).not.toHaveProperty('provider');
    expect(summary).not.toHaveProperty('model');
    expect(summary).not.toHaveProperty('dependencies');

    const livenessResponse = await fetch(`${productionBaseUrl}/health/live`);
    const liveness = await readJson(livenessResponse);

    expect(livenessResponse.status).toBe(200);
    expectRequestId(livenessResponse);
    expect(liveness).toEqual({
      ok: true,
      live: true,
      service: 'unwoldang-cloudrun-api',
      status: 'live',
      timestamp: expect.any(String)
    });

    const readinessResponse = await fetch(`${productionBaseUrl}/health/ready`);
    const readiness = await readJson(readinessResponse);

    expect(readinessResponse.status).toBe(200);
    expectRequestId(readinessResponse);
    expect(readiness).toEqual({
      ok: true,
      ready: true,
      service: 'unwoldang-cloudrun-api',
      status: 'ready',
      timestamp: expect.any(String)
    });

    expect(summaryResponse.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(summaryResponse.headers.get('cache-control')).toBe('no-store');
    expect(summaryResponse.headers.get('x-content-type-options')).toBe('nosniff');
    expect(summaryResponse.headers.get('strict-transport-security')).toBe(
      'max-age=31536000; includeSubDomains'
    );
    expect(summaryResponse.headers.get('x-permitted-cross-domain-policies')).toBe(
      'none'
    );
    expect(summaryResponse.headers.get('referrer-policy')).toBe('no-referrer');
    expect(summaryResponse.headers.get('x-frame-options')).toBe('DENY');
    expect(summaryResponse.headers.get('permissions-policy')).toBe(
      'camera=(), microphone=(), geolocation=()'
    );
    expect(summaryResponse.headers.get('content-security-policy')).toBe(
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    );

    const unavailable = await startApp({
      config: loadConfig({}),
      fetchImplementation: unexpectedExternalFetch as unknown as typeof fetch,
      reportGenerator: productionReportGenerator as unknown as CreateAppOptions['reportGenerator']
    });

    try {
      const response = await fetch(`${unavailable.baseUrl}/health/ready`);
      expect(response.status).toBe(503);
      expectRequestId(response);
      expect(await readJson(response)).toEqual({
        ok: false,
        ready: false,
        service: 'unwoldang-cloudrun-api',
        status: 'not_ready',
        timestamp: expect.any(String)
      });
    } finally {
      await closeServer(unavailable.server);
    }
  });

  it('allows and exposes X-Request-ID through configured CORS responses', async () => {
    const corsResponse = await fetch(`${productionBaseUrl}/health`, {
      headers: {
        Origin: ALLOWED_ORIGIN,
        'X-Request-ID': FIXED_REQUEST_ID
      }
    });

    expect(corsResponse.status).toBe(200);
    expect(corsResponse.headers.get('x-request-id')).toBe(FIXED_REQUEST_ID);
    expect(corsResponse.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    expect(corsResponse.headers.get('vary')).toBe('Origin');
    expect(corsResponse.headers.get('access-control-allow-methods')).toBe(
      'GET,POST,OPTIONS'
    );
    expect(corsResponse.headers.get('access-control-allow-headers')).toBe(
      'Content-Type, Authorization, X-Request-ID'
    );
    expect(corsResponse.headers.get('access-control-expose-headers')).toBe(
      'X-Request-ID, Retry-After'
    );

    const preflight = await fetch(`${productionBaseUrl}/api/report`, {
      method: 'OPTIONS',
      headers: {
        Origin: ALLOWED_ORIGIN,
        'Access-Control-Request-Method': 'POST'
      }
    });

    expect(preflight.status).toBe(204);
    expectRequestId(preflight);
    expect(await preflight.text()).toBe('');
    expect(preflight.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    expect(preflight.headers.get('access-control-allow-methods')).toBe(
      'GET,POST,OPTIONS'
    );
    expect(preflight.headers.get('access-control-allow-headers')).toBe(
      'Content-Type, Authorization, X-Request-ID'
    );
    expect(preflight.headers.get('access-control-expose-headers')).toBe(
      'X-Request-ID, Retry-After'
    );

    const rejectedLocalOrigin = await fetch(`${productionBaseUrl}/health`, {
      headers: { Origin: 'http://localhost:5173' }
    });
    expect(rejectedLocalOrigin.status).toBe(200);
    expect(rejectedLocalOrigin.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('returns a standard 404 without disclosing the route inventory', async () => {
    const response = await fetch(`${productionBaseUrl}/not-a-route`);

    expect(PUBLIC_ROUTES).toEqual(EXPECTED_PUBLIC_ROUTES);
    const body = await expectPublicError(
      response,
      404,
      PUBLIC_ERROR_CODES.RESOURCE_NOT_FOUND
    );
    expect(body).not.toHaveProperty('routes');
  });

  it('preserves every bare and /api alias with the same authentication boundary', async () => {
    const cases = [
      {
        method: 'POST',
        paths: ['/report', '/api/report'],
        status: 401,
        errorCode: PUBLIC_ERROR_CODES.REPORT_ACCESS_REQUIRED
      },
      {
        method: 'POST',
        paths: ['/payments/portone/order', '/api/payments/portone/order'],
        status: 401,
        errorCode: PUBLIC_ERROR_CODES.AUTH_REQUIRED
      },
      {
        method: 'POST',
        paths: ['/payments/portone/confirm', '/api/payments/portone/confirm'],
        status: 401,
        errorCode: PUBLIC_ERROR_CODES.AUTH_REQUIRED
      },
      {
        method: 'GET',
        paths: [
          '/payments/portone/entitlements',
          '/api/payments/portone/entitlements'
        ],
        status: 401,
        errorCode: PUBLIC_ERROR_CODES.AUTH_REQUIRED
      },
      {
        method: 'POST',
        paths: [
          '/payments/portone/entitlement/renew',
          '/api/payments/portone/entitlement/renew'
        ],
        status: 401,
        errorCode: PUBLIC_ERROR_CODES.AUTH_REQUIRED
      },
      {
        method: 'POST',
        paths: ['/auth/kakao/exchange', '/api/auth/kakao/exchange'],
        status: 500,
        errorCode: PUBLIC_ERROR_CODES.AUTH_PROVIDER_FAILED
      },
      {
        method: 'GET',
        paths: ['/archive/reports', '/api/archive/reports'],
        status: 401,
        errorCode: PUBLIC_ERROR_CODES.AUTH_REQUIRED
      },
      {
        method: 'POST',
        paths: ['/archive/reports', '/api/archive/reports'],
        status: 401,
        errorCode: PUBLIC_ERROR_CODES.AUTH_REQUIRED
      },
      {
        method: 'POST',
        paths: ['/admin/login', '/api/admin/login'],
        status: 503,
        errorCode: PUBLIC_ERROR_CODES.ADMIN_AUTH_FAILED
      },
      {
        method: 'GET',
        paths: ['/admin/reports', '/api/admin/reports'],
        status: 401,
        errorCode: PUBLIC_ERROR_CODES.ADMIN_AUTH_FAILED
      }
    ] as const;

    for (const contract of cases) {
      for (const path of contract.paths) {
        const isPost = contract.method === 'POST';
        const response = await fetch(`${productionBaseUrl}${path}`, {
          method: contract.method,
          headers: isPost ? { 'Content-Type': 'application/json' } : undefined,
          body: isPost ? '{}' : undefined
        });

        await expectPublicError(
          response,
          contract.status,
          contract.errorCode
        );
      }
    }
  });

  it('rejects malformed JSON with the standard error envelope', async () => {
    const response = await fetch(`${productionBaseUrl}/api/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{'
    });

    await expectPublicError(response, 400, PUBLIC_ERROR_CODES.REQUEST_INVALID);
  });

  it('enforces independent auth, payment, report, and admin limits with Retry-After', async () => {
    const reportGenerator = vi.fn(async (body: Record<string, unknown>) => ({
      provider: 'fixture-report-generator',
      received: body
    }));
    const developmentConfig = loadConfig({
      NODE_ENV: 'development',
      ALLOW_UNVERIFIED_REPORTS: 'true',
      AUTH_RATE_LIMIT_MAX: '1',
      PAYMENT_RATE_LIMIT_MAX: '1',
      REPORT_RATE_LIMIT_MAX: '1',
      ADMIN_RATE_LIMIT_MAX: '1',
      AUTH_RATE_LIMIT_WINDOW_MS: '60000',
      PAYMENT_RATE_LIMIT_WINDOW_MS: '60000',
      REPORT_RATE_LIMIT_WINDOW_MS: '60000',
      ADMIN_RATE_LIMIT_WINDOW_MS: '60000'
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
      expectRequestId(success);
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

      const reportLimited = await fetch(`${running.baseUrl}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      await expectRateLimited(reportLimited);

      const scopedRequests = [
        {
          path: '/api/auth/kakao/exchange',
          init: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
          }
        },
        {
          path: '/api/payments/portone/entitlements',
          init: { method: 'GET' }
        },
        {
          path: '/api/admin/reports',
          init: { method: 'GET' }
        }
      ] satisfies Array<{ path: string; init: RequestInit }>;

      for (const request of scopedRequests) {
        const first = await fetch(`${running.baseUrl}${request.path}`, request.init);
        expect(first.status).not.toBe(429);
        expectRequestId(first);

        const limited = await fetch(`${running.baseUrl}${request.path}`, request.init);
        await expectRateLimited(limited);
      }
      expect(reportGenerator).toHaveBeenCalledTimes(1);
    } finally {
      await closeServer(running.server);
    }
  });

  it('keeps the legacy in-progress code alongside the standard error contract', async () => {
    const running = await startApp({
      config: loadConfig({
        ALLOW_UNVERIFIED_REPORTS: 'true',
        REPORT_RATE_LIMIT_MAX: '10'
      }),
      fetchImplementation: unexpectedExternalFetch as unknown as typeof fetch,
      reportGenerator: vi.fn(async () => {
        throw new ReportGenerationInProgressError();
      }) as unknown as CreateAppOptions['reportGenerator']
    });

    try {
      const response = await fetch(`${running.baseUrl}/api/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: 'general-signature', payload: {} })
      });

      await expectPublicError(
        response,
        409,
        PUBLIC_ERROR_CODES.REPORT_GENERATION_IN_PROGRESS,
        {
          code: PUBLIC_ERROR_CODES.REPORT_GENERATION_IN_PROGRESS,
          retryAfterSeconds: 3
        }
      );
      expect(response.headers.get('retry-after')).toBe('3');
    } finally {
      await closeServer(running.server);
    }
  });

  it('does not let a malicious report body contaminate trusted failure-log dimensions', async () => {
    const records: StructuredLogRecord[] = [];
    const logger: StructuredLogger = {
      log(record) {
        records.push({ ...record });
      }
    };
    const rawOrderId = 'UW-private-order-fixture';
    const reportConfig = loadConfig({
      REPORT_ACCESS_SECRET: 'fixture-observability-report-secret',
      REPORT_RATE_LIMIT_MAX: '10'
    });
    const reportAccessToken = new TokenService(reportConfig).createReportAccessToken({
      userId: 'fixture-observability-user',
      orderId: rawOrderId,
      paymentId: 'fixture-observability-payment',
      productId: 'general-signature',
      amount: 79_000,
      entitlementId: 'fixture-observability-entitlement'
    });
    const sensitiveValues = [
      'Private Name',
      '1990-01-02',
      'private question body',
      'private@example.invalid',
      'private-token-value',
      'private-secret-value',
      reportAccessToken,
      rawOrderId
    ];
    const running = await startApp({
      config: reportConfig,
      fetchImplementation: unexpectedExternalFetch as unknown as typeof fetch,
      reportGenerator: vi.fn(async () => {
        throw Object.assign(new Error('raw provider failure must stay private'), {
          status: 503
        });
      }) as unknown as CreateAppOptions['reportGenerator'],
      logger
    });

    try {
      const response = await fetch(`${running.baseUrl}/api/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': FIXED_REQUEST_ID
        },
        body: JSON.stringify({
          serviceId: 'general-signature',
          orderId: rawOrderId,
          reportAccessToken,
          productId: 'love-reading',
          provider: 'deterministic-fallback',
          degraded: true,
          name: 'Private Name',
          birthDate: '1990-01-02',
          question: 'private question body',
          email: 'private@example.invalid',
          token: 'private-token-value',
          secret: 'private-secret-value',
          payload: { fixture: true }
        })
      });

      await expectPublicError(
        response,
        503,
        PUBLIC_ERROR_CODES.REPORT_GENERATION_FAILED
      );
      await new Promise<void>((resolve) => setImmediate(resolve));

      const requestLog = records.find((record) => record.event === 'http_request');
      expect(requestLog).toMatchObject({
        requestId: FIXED_REQUEST_ID,
        route: 'POST /api/report',
        status: 503,
        latencyMs: expect.any(Number),
        errorCode: PUBLIC_ERROR_CODES.REPORT_GENERATION_FAILED,
        productId: 'general-signature',
        orderHash: hashOrderId(rawOrderId),
        degraded: false
      });
      expect(requestLog?.provider).toBeUndefined();

      const serialized = JSON.stringify(records);
      for (const sensitiveValue of sensitiveValues) {
        expect(serialized).not.toContain(sensitiveValue);
      }
      expect(serialized).not.toContain('raw provider failure');
    } finally {
      await closeServer(running.server);
    }
  });

  it('does not assign a responsibility provider before user auth succeeds', async () => {
    const records: StructuredLogRecord[] = [];
    const providerFetch = vi.fn(async () => {
      throw new Error('Provider fetch must not run before user auth.');
    });
    const running = await startApp({
      config: loadConfig({
        USER_ACCESS_SECRET: `test-user-${'u'.repeat(32)}`,
        PAYMENT_RATE_LIMIT_MAX: '10'
      }),
      fetchImplementation: providerFetch as unknown as typeof fetch,
      logger: {
        log(record) {
          records.push({ ...record });
        }
      }
    });

    try {
      const response = await fetch(
        `${running.baseUrl}/api/payments/portone/entitlements`
      );

      await expectPublicError(response, 401, PUBLIC_ERROR_CODES.AUTH_REQUIRED);
      await new Promise<void>((resolve) => setImmediate(resolve));

      const requestLog = records.find((record) => record.event === 'http_request');
      expect(requestLog).toMatchObject({
        route: 'GET /api/payments/portone/entitlements',
        errorCode: PUBLIC_ERROR_CODES.AUTH_REQUIRED
      });
      expect(requestLog?.provider).toBeUndefined();
      expect(providerFetch).not.toHaveBeenCalled();
    } finally {
      await closeServer(running.server);
    }
  });

  it.each([401, 403])(
    'maps Kakao upstream status %s to auth provider failure without leaking raw details',
    async (status) => {
      const rawProviderMessage = `raw-kakao-provider-message-${status}`;
      const records: StructuredLogRecord[] = [];
      const providerFetch = vi.fn(async () =>
        new Response(
          JSON.stringify({ error_description: rawProviderMessage }),
          {
            status,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      );
      const running = await startApp({
        config: loadConfig({
          KAKAO_REST_API_KEY: 'kakao-live-key',
          USER_ACCESS_SECRET: `test-user-${'u'.repeat(32)}`,
          AUTH_RATE_LIMIT_MAX: '10'
        }),
        fetchImplementation: providerFetch as unknown as typeof fetch,
        logger: {
          log(record) {
            records.push({ ...record });
          }
        }
      });

      try {
        const response = await fetch(`${running.baseUrl}/api/auth/kakao/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: 'fixture-authorization-code',
            redirectUri: 'https://contract.example/auth/kakao/callback'
          })
        });

        await expectPublicError(
          response,
          status,
          PUBLIC_ERROR_CODES.AUTH_PROVIDER_FAILED
        );
        await new Promise<void>((resolve) => setImmediate(resolve));

        expect(providerFetch).toHaveBeenCalledTimes(1);
        expect(records.find((record) => record.event === 'http_request')).toMatchObject({
          route: 'POST /api/auth/kakao/exchange',
          status,
          errorCode: PUBLIC_ERROR_CODES.AUTH_PROVIDER_FAILED,
          provider: 'kakao'
        });
        expect(JSON.stringify(records)).not.toContain(rawProviderMessage);
      } finally {
        await closeServer(running.server);
      }
    }
  );

  it.each([401, 403])(
    'maps PortOne upstream status %s to payment confirmation failure',
    async (status) => {
      const rawProviderMessage = `raw-portone-provider-message-${status}`;
      const records: StructuredLogRecord[] = [];
      const paymentConfig = loadConfig({
        REPORT_ACCESS_SECRET: `test-report-${'r'.repeat(32)}`,
        USER_ACCESS_SECRET: `test-user-${'u'.repeat(32)}`,
        PORTONE_API_SECRET: 'portone-live-secret',
        PORTONE_STORE_ID: 'store-live',
        PAYMENT_RATE_LIMIT_MAX: '20'
      });
      const userToken = new TokenService(paymentConfig).createUserAccessToken({
        id: 'fixture-provider-user'
      });
      const providerFetch = vi.fn(async () =>
        new Response(
          JSON.stringify({ message: rawProviderMessage }),
          {
            status,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      );
      const running = await startApp({
        config: paymentConfig,
        fetchImplementation: providerFetch as unknown as typeof fetch,
        logger: {
          log(record) {
            records.push({ ...record });
          }
        }
      });

      try {
        const orderResponse = await fetch(
          `${running.baseUrl}/api/payments/portone/order`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${userToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ productId: 'general-signature' })
          }
        );
        const order = await readJson(orderResponse);
        expect(orderResponse.status).toBe(200);

        const response = await fetch(
          `${running.baseUrl}/api/payments/portone/confirm`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${userToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              paymentId: order.orderId,
              orderId: order.orderId,
              productId: order.productId,
              amount: order.amount,
              orderClaim: order.orderClaim
            })
          }
        );

        await expectPublicError(
          response,
          status,
          PUBLIC_ERROR_CODES.PAYMENT_CONFIRMATION_FAILED
        );
        await new Promise<void>((resolve) => setImmediate(resolve));

        expect(providerFetch).toHaveBeenCalledTimes(1);
        expect(
          records.find(
            (record) => record.event === 'http_request' &&
              record.route === 'POST /api/payments/portone/confirm'
          )
        ).toMatchObject({
          status,
          errorCode: PUBLIC_ERROR_CODES.PAYMENT_CONFIRMATION_FAILED,
          provider: 'portone'
        });
        expect(JSON.stringify(records)).not.toContain(rawProviderMessage);
      } finally {
        await closeServer(running.server);
      }
    }
  );

  it('keeps archive report-token failure as access failure without claiming Firestore', async () => {
    const records: StructuredLogRecord[] = [];
    const archiveConfig = loadConfig({
      REPORT_ACCESS_SECRET: `test-report-${'r'.repeat(32)}`,
      USER_ACCESS_SECRET: `test-user-${'u'.repeat(32)}`,
      ENABLE_FIRESTORE_ARCHIVE: 'true',
      FIRESTORE_PROJECT_ID: 'unwoldang-prod',
      FIRESTORE_ACCESS_TOKEN: 'local-test-access-token',
      REPORT_RATE_LIMIT_MAX: '10'
    });
    const userToken = new TokenService(archiveConfig).createUserAccessToken({
      id: 'fixture-archive-user'
    });
    const providerFetch = vi.fn(async () => {
      throw new Error('Firestore must not run before report-token verification.');
    });
    const running = await startApp({
      config: archiveConfig,
      fetchImplementation: providerFetch as unknown as typeof fetch,
      logger: {
        log(record) {
          records.push({ ...record });
        }
      }
    });

    try {
      const response = await fetch(`${running.baseUrl}/api/archive/reports`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          entry: {
            id: 'fixture-archive-entry',
            productId: 'general-signature',
            reportData: { fixture: true }
          }
        })
      });

      await expectPublicError(response, 401, PUBLIC_ERROR_CODES.AUTH_REQUIRED);
      await new Promise<void>((resolve) => setImmediate(resolve));

      const requestLog = records.find((record) => record.event === 'http_request');
      expect(requestLog).toMatchObject({
        route: 'POST /api/archive/reports',
        errorCode: PUBLIC_ERROR_CODES.AUTH_REQUIRED
      });
      expect(requestLog?.provider).toBeUndefined();
      expect(providerFetch).not.toHaveBeenCalled();
    } finally {
      await closeServer(running.server);
    }
  });

  it('records Firestore for archive POST only after token validation and storage success', async () => {
    const records: StructuredLogRecord[] = [];
    const archiveConfig = loadConfig({
      REPORT_ACCESS_SECRET: `test-report-${'r'.repeat(32)}`,
      USER_ACCESS_SECRET: `test-user-${'u'.repeat(32)}`,
      ENABLE_FIRESTORE_ARCHIVE: 'true',
      FIRESTORE_PROJECT_ID: 'unwoldang-prod',
      FIRESTORE_ACCESS_TOKEN: 'local-test-access-token',
      REPORT_RATE_LIMIT_MAX: '10'
    });
    const tokens = new TokenService(archiveConfig);
    const userId = 'fixture-archive-success-user';
    const orderId = 'UW-fixture-archive-success-order';
    const userToken = tokens.createUserAccessToken({ id: userId });
    const reportAccessToken = tokens.createReportAccessToken({
      userId,
      orderId,
      paymentId: orderId,
      productId: 'general-signature',
      amount: 79_000,
      entitlementId: 'fixture-archive-success-entitlement'
    });
    const providerFetch = vi.fn(async () =>
      new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    const running = await startApp({
      config: archiveConfig,
      fetchImplementation: providerFetch as unknown as typeof fetch,
      logger: {
        log(record) {
          records.push({ ...record });
        }
      }
    });

    try {
      const response = await fetch(`${running.baseUrl}/api/archive/reports`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reportAccessToken,
          entry: {
            id: 'fixture-archive-success-entry',
            orderId,
            productId: 'general-signature',
            reportData: { fixture: true }
          }
        })
      });

      expect(response.status).toBe(200);
      expectRequestId(response);
      expect(await readJson(response)).toMatchObject({
        ok: true,
        entry: {
          id: 'fixture-archive-success-entry',
          orderId,
          productId: 'general-signature'
        }
      });
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(providerFetch).toHaveBeenCalledTimes(1);
      expect(records.find((record) => record.event === 'http_request')).toMatchObject({
        route: 'POST /api/archive/reports',
        status: 200,
        provider: 'firestore'
      });
    } finally {
      await closeServer(running.server);
    }
  });

  it('classifies authenticated admin Firestore failures as archive failures', async () => {
    const rawProviderMessage = 'raw-firestore-admin-provider-message';
    const records: StructuredLogRecord[] = [];
    const adminConfig = loadConfig({
      ADMIN_ACCESS_SECRET: `test-admin-${'a'.repeat(32)}`,
      ENABLE_FIRESTORE_ARCHIVE: 'true',
      FIRESTORE_PROJECT_ID: 'unwoldang-prod',
      FIRESTORE_ACCESS_TOKEN: 'local-test-access-token',
      ADMIN_RATE_LIMIT_MAX: '10'
    });
    const adminToken = new TokenService(adminConfig).createAdminAccessToken('fixture-admin');
    const providerFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ error: { message: rawProviderMessage } }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    );
    const running = await startApp({
      config: adminConfig,
      fetchImplementation: providerFetch as unknown as typeof fetch,
      logger: {
        log(record) {
          records.push({ ...record });
        }
      }
    });

    try {
      const response = await fetch(`${running.baseUrl}/api/admin/reports`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      await expectPublicError(
        response,
        503,
        PUBLIC_ERROR_CODES.ARCHIVE_OPERATION_FAILED
      );
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(providerFetch).toHaveBeenCalledTimes(1);
      expect(records.find((record) => record.event === 'http_request')).toMatchObject({
        route: 'GET /api/admin/reports',
        status: 503,
        errorCode: PUBLIC_ERROR_CODES.ARCHIVE_OPERATION_FAILED,
        provider: 'firestore'
      });
      expect(JSON.stringify(records)).not.toContain(rawProviderMessage);
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
        errorCode: PUBLIC_ERROR_CODES.PAYMENT_REQUEST_FAILED
      },
      {
        productId: 'unknown-product',
        status: 400,
        errorCode: PUBLIC_ERROR_CODES.REQUEST_INVALID
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

      await expectPublicError(response, contract.status, contract.errorCode);
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
    expectRequestId(orderResponse);
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

    await expectPublicError(
      mismatch,
      409,
      PUBLIC_ERROR_CODES.PAYMENT_REQUEST_FAILED
    );
  });
});
