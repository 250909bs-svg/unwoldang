import type { IncomingMessage } from 'node:http';
import type { AppConfig } from '../config/env.ts';
import type { ReportAccessClaims } from '../contracts/auth.ts';
import { ReportRequestError } from '../contracts/errors.ts';
import type { TokenService } from '../domains/auth/tokenService.ts';

function getOptionalString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function getBearerToken(req: IncomingMessage) {
  const authorization = String(req.headers.authorization || '');

  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return '';
  }

  return authorization.slice(7).trim();
}

export function getReportBearerToken(req: IncomingMessage, body: Record<string, unknown>) {
  const authorization = String(req.headers.authorization || '');

  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }

  return getOptionalString(body, 'reportAccessToken');
}

export function verifyUserAccess(req: IncomingMessage, tokenService: TokenService) {
  const token = getBearerToken(req);

  if (!token) {
    throw new ReportRequestError(401, 'Login access token is required.');
  }

  return tokenService.verifyUserAccessToken(token);
}

export function verifyAdminAccess(req: IncomingMessage, tokenService: TokenService) {
  const token = getBearerToken(req);

  if (!token) {
    throw new ReportRequestError(401, 'Admin access token is required.');
  }

  return tokenService.verifyAdminAccessToken(token);
}

export function assertReportAccess(
  req: IncomingMessage,
  body: Record<string, unknown>,
  config: AppConfig,
  tokenService: TokenService
): ReportAccessClaims | null {
  if (config.report.allowUnverified) {
    return null;
  }

  const token = getReportBearerToken(req, body);

  if (!token) {
    throw new ReportRequestError(401, 'Report access token is required.');
  }

  const payload = tokenService.verifyReportAccessToken(token);
  const serviceId = getOptionalString(body, 'serviceId');
  const orderId = getOptionalString(body, 'orderId');

  if (!serviceId) {
    throw new ReportRequestError(400, 'serviceId is required for a paid report request.');
  }

  if (serviceId !== payload.productId) {
    throw new ReportRequestError(403, 'Report token does not match this product.');
  }

  if (orderId && orderId !== payload.orderId) {
    throw new ReportRequestError(403, 'Report token does not match this order.');
  }

  return payload;
}

export function createAuthMiddleware(config: AppConfig, tokenService: TokenService) {
  return {
    verifyUserAccess: (req: IncomingMessage) => verifyUserAccess(req, tokenService),
    verifyAdminAccess: (req: IncomingMessage) => verifyAdminAccess(req, tokenService),
    assertReportAccess: (req: IncomingMessage, body: Record<string, unknown>) =>
      assertReportAccess(req, body, config, tokenService)
  };
}
