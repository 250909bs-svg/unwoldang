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

    if (
      (!config.allowedOrigins.length && isLocalDevelopmentOrigin(origin)) ||
      config.allowedOrigins.includes(origin) ||
      isLocalDevelopmentOrigin(origin)
    ) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  };
}
