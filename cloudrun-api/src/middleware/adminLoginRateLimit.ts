import type { IncomingMessage } from 'node:http';
import type { AppConfig } from '../config/env.ts';
import { ReportRequestError } from '../contracts/errors.ts';

type FailureBucket = { failures: number; resetAt: number };

function getClientIp(req: IncomingMessage) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').map((value) => value.trim()).filter(Boolean);
  const trustedClient = forwarded.length >= 2
    ? forwarded[forwarded.length - 2]
    : forwarded[0];
  return trustedClient || req.socket?.remoteAddress || 'unknown';
}

export type AdminLoginRateLimit = {
  assertAllowed(req: IncomingMessage): void;
  recordFailure(req: IncomingMessage): void;
  reset(req: IncomingMessage): void;
};

export function createAdminLoginRateLimit(config: AppConfig): AdminLoginRateLimit {
  const buckets = new Map<string, FailureBucket>();
  const keyFor = (req: IncomingMessage) => getClientIp(req);
  const clearExpired = (now: number) => {
    if (buckets.size < 10_000) return;
    buckets.forEach((bucket, key) => {
      if (bucket.resetAt <= now) buckets.delete(key);
    });
  };

  return {
    assertAllowed(req) {
      const now = Date.now();
      clearExpired(now);
      const key = keyFor(req);
      const bucket = buckets.get(key);
      if (!bucket) return;
      if (bucket.resetAt <= now) {
        buckets.delete(key);
        return;
      }
      if (bucket.failures >= config.auth.adminLoginRateLimitMax) {
        throw new ReportRequestError(429, '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.');
      }
    },
    recordFailure(req) {
      const now = Date.now();
      const key = keyFor(req);
      const current = buckets.get(key);
      if (!current || current.resetAt <= now) {
        buckets.set(key, { failures: 1, resetAt: now + config.auth.adminLoginRateLimitWindowMs });
        return;
      }
      current.failures += 1;
    },
    reset(req) {
      buckets.delete(keyFor(req));
    }
  };
}
