import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';
import {
  ConfigValidationError,
  loadConfig,
  loadValidatedConfig,
  type RuntimeEnv
} from '../../../cloudrun-api/src/config/env.ts';
import { HealthService } from '../../../cloudrun-api/src/domains/health/healthService.ts';
import {
  createRateLimiters,
  createReportRateLimit,
  RateLimitExceededError
} from '../../../cloudrun-api/src/middleware/rateLimit.ts';

function requestFrom(ipAddress: string): IncomingMessage {
  return {
    headers: { 'x-forwarded-for': ipAddress },
    socket: {}
  } as unknown as IncomingMessage;
}

function productionEnvironment(overrides: RuntimeEnv = {}): RuntimeEnv {
  return {
    NODE_ENV: 'production',
    ALLOWED_ORIGINS: 'https://contract.example',
    REPORT_ACCESS_SECRET: 'fixture-report-secret',
    USER_ACCESS_SECRET: 'fixture-user-secret',
    ADMIN_ACCESS_SECRET: 'fixture-admin-secret',
    ADMIN_CREDENTIAL_HASH: 'fixture-admin-credential-hash',
    KAKAO_REST_API_KEY: 'fixture-kakao-key',
    PORTONE_API_SECRET: 'fixture-portone-secret',
    PORTONE_STORE_ID: 'fixture-portone-store',
    ENABLE_FIRESTORE_ARCHIVE: 'true',
    FIRESTORE_PROJECT_ID: 'fixture-project',
    REQUIRE_REPORT_TOKEN_FOR_ARCHIVE: 'true',
    ...overrides
  };
}

describe('Cloud Run startup configuration', () => {
  it('loads independent auth, payment, report, and admin rate-limit policies', () => {
    const config = loadConfig({
      AUTH_RATE_LIMIT_WINDOW_MS: '1000',
      AUTH_RATE_LIMIT_MAX: '2',
      PAYMENT_RATE_LIMIT_WINDOW_MS: '2000',
      PAYMENT_RATE_LIMIT_MAX: '3',
      REPORT_RATE_LIMIT_WINDOW_MS: '3000',
      REPORT_RATE_LIMIT_MAX: '4',
      ADMIN_RATE_LIMIT_WINDOW_MS: '4000',
      ADMIN_RATE_LIMIT_MAX: '5'
    });

    expect(config.rateLimits).toEqual({
      auth: { windowMs: 1000, max: 2 },
      payment: { windowMs: 2000, max: 3 },
      report: { windowMs: 3000, max: 4 },
      admin: { windowMs: 4000, max: 5 }
    });
    expect(config.report.rateLimitWindowMs).toBe(3000);
    expect(config.report.rateLimitMax).toBe(4);
  });

  it('rejects malformed or non-positive numeric environment values at validated startup', () => {
    expect(() =>
      loadValidatedConfig({
        REPORT_RATE_LIMIT_MAX: 'not-a-number',
        PAYMENT_ORDER_CLAIM_TTL_MS: '-1'
      })
    ).toThrow(ConfigValidationError);

    try {
      loadValidatedConfig({
        REPORT_RATE_LIMIT_MAX: 'not-a-number',
        PAYMENT_ORDER_CLAIM_TTL_MS: '-1'
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError);
      expect((error as ConfigValidationError).issues).toEqual(
        expect.arrayContaining([
          expect.stringContaining('REPORT_RATE_LIMIT_MAX'),
          expect.stringContaining('PAYMENT_ORDER_CLAIM_TTL_MS')
        ])
      );
    }
  });

  it('accepts a complete production configuration without requiring optional AI enhancement', () => {
    const config = loadValidatedConfig(productionEnvironment());

    expect(config.production).toBe(true);
    expect(config.gemini.configured).toBe(false);
  });

  it('fails production startup for missing required values and forbidden local bypasses', () => {
    try {
      loadValidatedConfig(
        productionEnvironment({
          REPORT_ACCESS_SECRET: '',
          ALLOW_UNVERIFIED_REPORTS: 'true',
          FIRESTORE_ACCESS_TOKEN: 'fixture-local-token',
          REQUIRE_REPORT_TOKEN_FOR_ARCHIVE: 'false'
        })
      );
      throw new Error('Expected production validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError);
      expect((error as ConfigValidationError).issues).toEqual(
        expect.arrayContaining([
          'REPORT_ACCESS_SECRET is required in production.',
          'ALLOW_UNVERIFIED_REPORTS=true is forbidden in production.',
          'FIRESTORE_ACCESS_TOKEN is forbidden in production; use the Cloud Run service account.',
          'REQUIRE_REPORT_TOKEN_FOR_ARCHIVE=false is forbidden in production.'
        ])
      );
    }
  });
});

describe('bounded scoped rate limiters', () => {
  it('isolates scopes and returns a typed retry contract', () => {
    let now = 10_000;
    const config = loadConfig({
      AUTH_RATE_LIMIT_WINDOW_MS: '2500',
      AUTH_RATE_LIMIT_MAX: '1',
      PAYMENT_RATE_LIMIT_WINDOW_MS: '2500',
      PAYMENT_RATE_LIMIT_MAX: '1'
    });
    const limiters = createRateLimiters(config, { now: () => now, maxBuckets: 10 });
    const request = requestFrom('198.51.100.10');

    limiters.auth(request);
    expect(() => limiters.auth(request)).toThrow(RateLimitExceededError);

    try {
      limiters.auth(request);
    } catch (error) {
      expect(error).toMatchObject({
        status: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        scope: 'auth',
        retryAfterSeconds: 3
      });
    }

    expect(() => limiters.payment(request)).not.toThrow();
    now += 2500;
    expect(() => limiters.auth(request)).not.toThrow();
  });

  it('fails closed at bucket capacity, then reclaims expired buckets', () => {
    let now = 20_000;
    const config = loadConfig({
      REPORT_RATE_LIMIT_WINDOW_MS: '1000',
      REPORT_RATE_LIMIT_MAX: '10'
    });
    const limiters = createRateLimiters(config, { now: () => now, maxBuckets: 1 });

    limiters.report(requestFrom('198.51.100.20'));

    expect(() => limiters.report(requestFrom('198.51.100.21'))).toThrowError(
      expect.objectContaining({
        code: 'RATE_LIMIT_EXCEEDED',
        scope: 'report',
        retryAfterSeconds: 1
      })
    );

    now += 1000;
    expect(() => limiters.report(requestFrom('198.51.100.21'))).not.toThrow();
  });

  it('keeps the existing report-only factory compatible', () => {
    const config = loadConfig({ REPORT_RATE_LIMIT_MAX: '1' });
    const enforceReportRateLimit = createReportRateLimit(config);
    const request = requestFrom('198.51.100.30');

    enforceReportRateLimit(request);
    expect(() => enforceReportRateLimit(request)).toThrowError(
      expect.objectContaining({
        code: 'RATE_LIMIT_EXCEEDED',
        scope: 'report'
      })
    );
  });
});

describe('non-disclosing health models', () => {
  it('separates summary, liveness, and readiness without dependency details', () => {
    const now = Date.parse('2026-07-22T00:00:00.000Z');
    const config = loadConfig(
      productionEnvironment({
        ADMIN_ACCESS_SECRET: '',
        ADMIN_CREDENTIAL_HASH: '',
        KAKAO_REST_API_KEY: ''
      })
    );
    const health = new HealthService(config, { now: () => now });

    expect(health.getSummaryStatus()).toEqual({
      ok: true,
      service: 'unwoldang-cloudrun-api',
      status: 'degraded',
      timestamp: '2026-07-22T00:00:00.000Z'
    });
    expect(health.getStatus()).toEqual(health.getSummaryStatus());
    expect(health.getLivenessStatus()).toEqual({
      ok: true,
      live: true,
      service: 'unwoldang-cloudrun-api',
      status: 'live',
      timestamp: '2026-07-22T00:00:00.000Z'
    });
    expect(health.getReadinessStatus()).toEqual({
      ok: true,
      ready: true,
      service: 'unwoldang-cloudrun-api',
      status: 'ready',
      timestamp: '2026-07-22T00:00:00.000Z'
    });

    for (const payload of [
      health.getSummaryStatus(),
      health.getLivenessStatus(),
      health.getReadinessStatus()
    ]) {
      expect(payload).not.toHaveProperty('provider');
      expect(payload).not.toHaveProperty('providerConfigured');
      expect(payload).not.toHaveProperty('model');
      expect(payload).not.toHaveProperty('dependencies');
    }
  });

  it('reports not-ready without naming the missing dependency', () => {
    const health = new HealthService(loadConfig({}), { now: () => 0 });

    expect(health.getReadinessStatus()).toEqual({
      ok: false,
      ready: false,
      service: 'unwoldang-cloudrun-api',
      status: 'not_ready',
      timestamp: '1970-01-01T00:00:00.000Z'
    });
    expect(health.getSummaryStatus()).toEqual({
      ok: false,
      service: 'unwoldang-cloudrun-api',
      status: 'not_ready',
      timestamp: '1970-01-01T00:00:00.000Z'
    });
  });
});
