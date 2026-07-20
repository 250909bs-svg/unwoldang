import type { IncomingMessage } from 'node:http';
import type { AppConfig } from '../config/env.ts';
import { ReportRequestError } from '../contracts/errors.ts';

type RateLimitBucket = { count: number; resetAt: number };

function getClientIp(req: IncomingMessage) {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0]?.trim();
  return forwardedFor || req.socket?.remoteAddress || 'unknown';
}

export function createReportRateLimit(config: AppConfig) {
  const buckets = new Map<string, RateLimitBucket>();

  return (req: IncomingMessage) => {
    const key = getClientIp(req);
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + config.report.rateLimitWindowMs
      });
      return;
    }

    bucket.count += 1;

    if (bucket.count > config.report.rateLimitMax) {
      throw new ReportRequestError(429, 'AI report request limit exceeded. Please try again shortly.');
    }
  };
}
