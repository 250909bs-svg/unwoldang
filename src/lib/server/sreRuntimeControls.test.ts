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

const TEST_LOAD_BALANCER_ADDRESS = '35.191.0.1';
const TEST_REPORT_SIGNING_SECRET = `test-report-${'r'.repeat(32)}`;
const TEST_USER_SIGNING_SECRET = `test-user-${'u'.repeat(32)}`;
const TEST_ADMIN_SIGNING_SECRET = `test-admin-${'a'.repeat(32)}`;
const TEST_ADMIN_CREDENTIAL_HASH = '0'.repeat(64);

function networkRequest(
  forwardedFor: string | string[] | undefined,
  remoteAddress?: string
): IncomingMessage {
  return {
    headers: forwardedFor === undefined ? {} : { 'x-forwarded-for': forwardedFor },
    socket: remoteAddress ? { remoteAddress } : {}
  } as unknown as IncomingMessage;
}

function requestFrom(ipAddress: string): IncomingMessage {
  return networkRequest(`${ipAddress}, ${TEST_LOAD_BALANCER_ADDRESS}`, '10.0.0.1');
}

function productionEnvironment(overrides: RuntimeEnv = {}): RuntimeEnv {
  return {
    NODE_ENV: 'production',
    ALLOWED_ORIGINS: 'https://contract.example',
    REPORT_ACCESS_SECRET: TEST_REPORT_SIGNING_SECRET,
    USER_ACCESS_SECRET: TEST_USER_SIGNING_SECRET,
    ADMIN_ACCESS_SECRET: TEST_ADMIN_SIGNING_SECRET,
    ADMIN_CREDENTIAL_HASH: TEST_ADMIN_CREDENTIAL_HASH,
    KAKAO_REST_API_KEY: ['synthetic', 'kakao', 'value'].join('-'),
    PORTONE_API_SECRET: ['synthetic', 'portone', 'value'].join('-'),
    PORTONE_STORE_ID: ['synthetic', 'store', 'value'].join('-'),
    ENABLE_FIRESTORE_ARCHIVE: 'true',
    FIRESTORE_PROJECT_ID: ['synthetic', 'project', 'value'].join('-'),
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

  it('rejects ready-looking production provider and storage placeholders without exposing values', () => {
    const rawPlaceholderValues = {
      KAKAO_REST_API_KEY: 'your_kakao_rest_api_key',
      PORTONE_API_SECRET: 'your_portone_v2_api_secret',
      PORTONE_STORE_ID: 'store-your-portone-store-id',
      FIRESTORE_PROJECT_ID: 'your-gcp-project-id'
    };

    try {
      loadValidatedConfig(productionEnvironment(rawPlaceholderValues));
      throw new Error('Expected production validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError);
      const validationError = error as ConfigValidationError;
      expect(validationError.issues).toEqual(
        expect.arrayContaining([
          'KAKAO_REST_API_KEY cannot use a known placeholder in production.',
          'PORTONE_API_SECRET cannot use a known placeholder in production.',
          'PORTONE_STORE_ID cannot use a known placeholder in production.',
          'FIRESTORE_PROJECT_ID cannot use a known placeholder in production.'
        ])
      );

      const diagnostic = `${validationError.message} ${validationError.issues.join(' ')}`;
      for (const placeholderValue of Object.values(rawPlaceholderValues)) {
        expect(diagnostic).not.toContain(placeholderValue);
      }
    }
  });

  it.each([
    ['GEMINI_API_KEY', 'your_gemini_api_key'],
    ['KASI_SERVICE_KEY', 'your_data_go_kr_service_key'],
    ['DATA_GO_KR_SERVICE_KEY', 'example-data-go-kr-key'],
    ['PUBLIC_DATA_SERVICE_KEY', 'fixture_public_data_key'],
    ['KAKAO_CLIENT_SECRET', 'your_kakao_client_secret_if_enabled']
  ])(
    'rejects configured optional production placeholder %s without exposing its value',
    (name, placeholder) => {
      try {
        loadValidatedConfig(productionEnvironment({ [name]: placeholder }));
        throw new Error('Expected production validation to fail.');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigValidationError);
        const validationError = error as ConfigValidationError;
        expect(validationError.issues).toContain(
          `${name} cannot use a known placeholder in production.`
        );
        expect(
          `${validationError.message} ${validationError.issues.join(' ')}`
        ).not.toContain(placeholder);
      }
    }
  );

  it.each(['fixture-provider-value', 'example_provider_value'])(
    'rejects the production placeholder family %s',
    (placeholder) => {
      expect(() =>
        loadValidatedConfig(productionEnvironment({ KAKAO_REST_API_KEY: placeholder }))
      ).toThrow(ConfigValidationError);
    }
  );

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

  it('rejects weak, placeholder, repeated signing secrets and malformed admin hashes', () => {
    const rawSensitiveValues = [
      'replace_with_a_long_random_secret_value',
      'too-short',
      'A'.repeat(64)
    ];

    try {
      loadValidatedConfig(
        productionEnvironment({
          REPORT_ACCESS_SECRET: rawSensitiveValues[0],
          USER_ACCESS_SECRET: rawSensitiveValues[1],
          ADMIN_ACCESS_SECRET: rawSensitiveValues[1],
          ADMIN_CREDENTIAL_HASH: rawSensitiveValues[2]
        })
      );
      throw new Error('Expected production validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError);
      const validationError = error as ConfigValidationError;
      expect(validationError.issues).toEqual(
        expect.arrayContaining([
          'REPORT_ACCESS_SECRET must contain at least 32 characters and cannot use a known placeholder.',
          'USER_ACCESS_SECRET must contain at least 32 characters and cannot use a known placeholder.',
          'ADMIN_ACCESS_SECRET must contain at least 32 characters and cannot use a known placeholder.',
          'REPORT_ACCESS_SECRET, USER_ACCESS_SECRET, and ADMIN_ACCESS_SECRET must be distinct.',
          'ADMIN_CREDENTIAL_HASH must be a lowercase 64-character hexadecimal SHA-256 digest.'
        ])
      );

      const diagnostic = `${validationError.message} ${validationError.issues.join(' ')}`;
      for (const sensitiveValue of rawSensitiveValues) {
        expect(diagnostic).not.toContain(sensitiveValue);
      }
    }
  });

  it.each([
    'http://contract.example',
    'https://contract.example/',
    'https://user@contract.example',
    'https://contract.example/path',
    'https://contract.example?debug=1',
    'https://contract.example#fragment',
    'https://*.contract.example',
    'null',
    'https://localhost',
    'https://127.0.0.1',
    'https://[::1]'
  ])('rejects unsafe production origin %s', (allowedOrigin) => {
    try {
      loadValidatedConfig(productionEnvironment({ ALLOWED_ORIGINS: allowedOrigin }));
      throw new Error('Expected production validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError);
      expect((error as ConfigValidationError).issues).toContain(
        'ALLOWED_ORIGINS contains an invalid production origin.'
      );
      expect((error as ConfigValidationError).message).not.toContain(allowedOrigin);
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

  it('ignores forged X-Forwarded-For prefixes and limits the penultimate client address', () => {
    const config = loadConfig({ AUTH_RATE_LIMIT_MAX: '1' });
    const limiters = createRateLimiters(config, { maxBuckets: 10 });
    const firstRequest = networkRequest(
      `203.0.113.10, 198.51.100.40, ${TEST_LOAD_BALANCER_ADDRESS}`,
      '10.0.0.1'
    );
    const secondRequest = networkRequest(
      `203.0.113.11, 198.51.100.40, ${TEST_LOAD_BALANCER_ADDRESS}`,
      '10.0.0.1'
    );

    limiters.auth(firstRequest);
    expect(() => limiters.auth(secondRequest)).toThrowError(
      expect.objectContaining({
        code: 'RATE_LIMIT_EXCEEDED',
        scope: 'auth'
      })
    );
  });

  it('falls back to the kernel peer for malformed or ambiguous forwarded chains', () => {
    const config = loadConfig({ PAYMENT_RATE_LIMIT_MAX: '1' });
    const limiters = createRateLimiters(config, { maxBuckets: 10 });
    const malformedChain = networkRequest(
      '198.51.100.50, not-a-load-balancer-ip',
      '192.0.2.44'
    );
    const ambiguousSingleAddress = networkRequest('203.0.113.99', '192.0.2.44');

    limiters.payment(malformedChain);
    expect(() => limiters.payment(ambiguousSingleAddress)).toThrowError(
      expect.objectContaining({
        code: 'RATE_LIMIT_EXCEEDED',
        scope: 'payment'
      })
    );
  });

  it('uses one fail-closed bucket when neither proxy nor kernel address is trustworthy', () => {
    const config = loadConfig({ REPORT_RATE_LIMIT_MAX: '1' });
    const limiters = createRateLimiters(config, { maxBuckets: 10 });
    const ambiguousHeaderArray = networkRequest([
      '198.51.100.60',
      TEST_LOAD_BALANCER_ADDRESS
    ]);
    const invalidAddresses = networkRequest('not-an-ip, still-not-an-ip', 'proxy-host');

    limiters.report(ambiguousHeaderArray);
    expect(() => limiters.report(invalidAddresses)).toThrowError(
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
