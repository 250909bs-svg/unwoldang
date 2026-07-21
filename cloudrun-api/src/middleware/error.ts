import type { ServerResponse } from 'node:http';
import { applySecurityHeaders } from './security.ts';

export function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  applySecurityHeaders(res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}
