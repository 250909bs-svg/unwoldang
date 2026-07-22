import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AppConfig } from '../config/env.ts';

function isLocalDevelopmentOrigin(origin: string) {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
}

export function createCorsMiddleware(config: AppConfig) {
  return (req: IncomingMessage, res: ServerResponse) => {
    const origin = req.headers.origin;

    if (!origin) {
      return;
    }

    const localDevelopmentOrigin = isLocalDevelopmentOrigin(origin);

    if (
      (!config.production && localDevelopmentOrigin) ||
      (!localDevelopmentOrigin && config.allowedOrigins.includes(origin))
    ) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
    res.setHeader('Access-Control-Expose-Headers', 'X-Request-ID, Retry-After');
  };
}
