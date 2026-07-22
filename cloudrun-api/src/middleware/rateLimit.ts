import type { IncomingMessage } from 'node:http';
import type { AppConfig, RateLimitPolicy } from '../config/env.ts';
import { ReportRequestError } from '../contracts/errors.ts';

export type RateLimitScope = 'auth' | 'payment' | 'report' | 'admin';

export type RateLimiter = (req: IncomingMessage) => void;

export type RateLimiterOptions = Readonly<{
  now?: () => number;
  maxBuckets?: number;
}>;

export type RateLimiters = Readonly<Record<RateLimitScope, RateLimiter>>;

type RateLimitBucket = { count: number; resetAt: number };

const DEFAULT_MAX_BUCKETS = 10_000;

const RATE_LIMIT_MESSAGES: Readonly<Record<RateLimitScope, string>> = Object.freeze({
  auth: 'Too many authentication requests. Please try again shortly.',
  payment: 'Too many payment requests. Please try again shortly.',
  report: 'AI report request limit exceeded. Please try again shortly.',
  admin: 'Too many administrator requests. Please try again shortly.'
});

export class RateLimitExceededError extends ReportRequestError {
  readonly code = 'RATE_LIMIT_EXCEEDED';

  constructor(
    readonly scope: RateLimitScope,
    readonly retryAfterSeconds: number
  ) {
    super(429, RATE_LIMIT_MESSAGES[scope]);
    this.name = 'RateLimitExceededError';
  }
}

function getClientIp(req: IncomingMessage) {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0]?.trim();
  return forwardedFor || req.socket?.remoteAddress || 'unknown';
}

function retryAfterSeconds(resetAt: number, now: number) {
  return Math.max(1, Math.ceil((resetAt - now) / 1000));
}

function assertPolicy(scope: RateLimitScope, policy: RateLimitPolicy) {
  if (!Number.isSafeInteger(policy.windowMs) || policy.windowMs <= 0) {
    throw new Error(`${scope} rate limit window must be a positive integer.`);
  }

  if (!Number.isSafeInteger(policy.max) || policy.max <= 0) {
    throw new Error(`${scope} rate limit maximum must be a positive integer.`);
  }
}

function createScopedRateLimiter(
  scope: RateLimitScope,
  policy: RateLimitPolicy,
  options: Required<RateLimiterOptions>
): RateLimiter {
  assertPolicy(scope, policy);
  const buckets = new Map<string, RateLimitBucket>();

  function fail(resetAt: number, now: number): never {
    throw new RateLimitExceededError(scope, retryAfterSeconds(resetAt, now));
  }

  return (req: IncomingMessage) => {
    const now = options.now();

    if (!Number.isFinite(now)) {
      throw new Error('Rate limiter clock returned an invalid timestamp.');
    }

    const key = getClientIp(req);
    const bucket = buckets.get(key);

    if (bucket && bucket.resetAt > now) {
      if (bucket.count >= policy.max) {
        fail(bucket.resetAt, now);
      }

      bucket.count += 1;
      return;
    }

    if (bucket) {
      buckets.delete(key);
    }

    if (buckets.size >= options.maxBuckets) {
      let earliestResetAt = Number.POSITIVE_INFINITY;

      for (const [bucketKey, candidate] of buckets) {
        if (candidate.resetAt <= now) {
          buckets.delete(bucketKey);
        } else {
          earliestResetAt = Math.min(earliestResetAt, candidate.resetAt);
        }
      }

      if (buckets.size >= options.maxBuckets) {
        fail(Number.isFinite(earliestResetAt) ? earliestResetAt : now + policy.windowMs, now);
      }
    }

    buckets.set(key, {
      count: 1,
      resetAt: now + policy.windowMs
    });
  };
}

export function createRateLimiters(
  config: AppConfig,
  options: RateLimiterOptions = {}
): RateLimiters {
  const maxBuckets = options.maxBuckets ?? DEFAULT_MAX_BUCKETS;

  if (!Number.isSafeInteger(maxBuckets) || maxBuckets <= 0) {
    throw new Error('Rate limiter maxBuckets must be a positive integer.');
  }

  const resolvedOptions: Required<RateLimiterOptions> = {
    now: options.now || Date.now,
    maxBuckets
  };

  return {
    auth: createScopedRateLimiter('auth', config.rateLimits.auth, resolvedOptions),
    payment: createScopedRateLimiter('payment', config.rateLimits.payment, resolvedOptions),
    report: createScopedRateLimiter('report', config.rateLimits.report, resolvedOptions),
    admin: createScopedRateLimiter('admin', config.rateLimits.admin, resolvedOptions)
  };
}

export function createReportRateLimit(config: AppConfig): RateLimiter {
  return createRateLimiters(config).report;
}
