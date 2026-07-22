import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import type { AuthenticatedUser, ReportAccessClaims } from '../contracts/auth.ts';
import { PUBLIC_ERROR_CODES, type ErrorDomain } from '../contracts/errors.ts';
import { readJsonBody } from './body.ts';
import { sendApiError, sendJson, sendPublicError } from '../middleware/error.ts';
import { applySecurityHeaders } from '../middleware/security.ts';
import {
  recordTrustedRequestAttributes,
  recordUntrustedRequestAttributes,
  setRequestProvider,
  setRequestRoute
} from '../observability/requestContext.ts';

export const PUBLIC_ROUTES = Object.freeze([
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
]);

type RateLimitScope = 'auth' | 'payment' | 'report' | 'admin';

type AuthMiddleware = {
  verifyUserAccess(req: IncomingMessage): AuthenticatedUser;
  verifyAdminAccess(req: IncomingMessage): unknown;
  assertReportAccess(req: IncomingMessage, body: Record<string, unknown>): ReportAccessClaims | null;
};

type HealthPayload = Record<string, unknown> & { ready?: boolean };

type RouterDependencies = {
  applyCors(req: IncomingMessage, res: ServerResponse): void;
  rateLimits: Record<RateLimitScope, (req: IncomingMessage) => void>;
  auth: AuthMiddleware;
  health: {
    getSummaryStatus(): HealthPayload;
    getLivenessStatus(): HealthPayload;
    getReadinessStatus(): HealthPayload;
  };
  reports: {
    generate(reportAccess: ReportAccessClaims | null, reportBody: Record<string, unknown>): Promise<unknown>;
  };
  payments: {
    createOrder(user: AuthenticatedUser, body: Record<string, unknown>): unknown;
    confirm(user: AuthenticatedUser, body: Record<string, unknown>): Promise<unknown>;
    listEntitlements(user: AuthenticatedUser): Promise<unknown[]>;
    renew(user: AuthenticatedUser, body: Record<string, unknown>): Promise<unknown>;
  };
  kakao: { exchange(body: Record<string, unknown>): Promise<unknown> };
  archives: {
    list(whereUserId?: string): Promise<unknown[]>;
    save(userId: string, body: Record<string, unknown>): Promise<unknown>;
  };
  admin: { login(body: Record<string, unknown>): unknown };
};

function isPath(pathname: string, barePath: string) {
  return pathname === barePath || pathname === '/api' + barePath;
}

function routeLabel(method: string, pathname: string) {
  if (method === 'GET' && pathname === '/health') return 'GET /health';
  if (method === 'GET' && pathname === '/health/live') return 'GET /health/live';
  if (method === 'GET' && pathname === '/health/ready') return 'GET /health/ready';
  if (method === 'POST' && isPath(pathname, '/report')) return 'POST /api/report';
  if (method === 'POST' && isPath(pathname, '/payments/portone/order')) return 'POST /api/payments/portone/order';
  if (method === 'POST' && isPath(pathname, '/payments/portone/confirm')) return 'POST /api/payments/portone/confirm';
  if (method === 'GET' && isPath(pathname, '/payments/portone/entitlements')) return 'GET /api/payments/portone/entitlements';
  if (method === 'POST' && isPath(pathname, '/payments/portone/entitlement/renew')) return 'POST /api/payments/portone/entitlement/renew';
  if (method === 'POST' && isPath(pathname, '/auth/kakao/exchange')) return 'POST /api/auth/kakao/exchange';
  if (method === 'GET' && isPath(pathname, '/archive/reports')) return 'GET /api/archive/reports';
  if (method === 'POST' && isPath(pathname, '/archive/reports')) return 'POST /api/archive/reports';
  if (method === 'POST' && isPath(pathname, '/admin/login')) return 'POST /api/admin/login';
  if (method === 'GET' && isPath(pathname, '/admin/reports')) return 'GET /api/admin/reports';
  if (method === 'OPTIONS') return 'OPTIONS /preflight';
  return 'UNMATCHED';
}

async function handle(
  res: ServerResponse,
  domain: ErrorDomain,
  operation: () => Promise<void> | void
) {
  try {
    await operation();
  } catch (error) {
    sendApiError(res, error, domain);
  }
}

export function createRouter(dependencies: RouterDependencies): RequestListener {
  return async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      const method = req.method || 'GET';
      const matchedRoute = routeLabel(method, url.pathname);
      setRequestRoute(matchedRoute);
      dependencies.applyCors(req, res);
      applySecurityHeaders(res);

      if (method === 'OPTIONS') {
        res.statusCode = 204;
        res.setHeader('Cache-Control', 'no-store');
        res.end();
        return;
      }

      if (method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, dependencies.health.getSummaryStatus());
        return;
      }

      if (method === 'GET' && url.pathname === '/health/live') {
        sendJson(res, 200, dependencies.health.getLivenessStatus());
        return;
      }

      if (method === 'GET' && url.pathname === '/health/ready') {
        const readiness = dependencies.health.getReadinessStatus();
        sendJson(res, readiness.ready === true ? 200 : 503, readiness);
        return;
      }

      if (method === 'POST' && isPath(url.pathname, '/report')) {
        await handle(res, 'report', async () => {
          dependencies.rateLimits.report(req);
          const body = (await readJsonBody(req)) as Record<string, unknown>;
          recordUntrustedRequestAttributes(body);
          const reportAccess = dependencies.auth.assertReportAccess(req, body);
          recordTrustedRequestAttributes(reportAccess);
          const { reportAccessToken, orderId, ...reportBody } = body;
          void reportAccessToken;
          void orderId;
          const payload = await dependencies.reports.generate(reportAccess, reportBody);
          sendJson(res, 200, payload);
        });
        return;
      }

      if (method === 'POST' && isPath(url.pathname, '/payments/portone/order')) {
        await handle(res, 'generic', async () => {
          dependencies.rateLimits.payment(req);
          const user = dependencies.auth.verifyUserAccess(req);
          const body = (await readJsonBody(req)) as Record<string, unknown>;
          recordUntrustedRequestAttributes(body);
          await handle(res, 'payment', () => {
            sendJson(res, 200, dependencies.payments.createOrder(user, body));
          });
        });
        return;
      }

      if (method === 'POST' && isPath(url.pathname, '/payments/portone/confirm')) {
        await handle(res, 'generic', async () => {
          dependencies.rateLimits.payment(req);
          const user = dependencies.auth.verifyUserAccess(req);
          const body = (await readJsonBody(req)) as Record<string, unknown>;
          recordUntrustedRequestAttributes(body);
          await handle(res, 'payment-confirmation', async () => {
            setRequestProvider('portone');
            sendJson(res, 200, await dependencies.payments.confirm(user, body));
          });
        });
        return;
      }

      if (method === 'GET' && isPath(url.pathname, '/payments/portone/entitlements')) {
        await handle(res, 'generic', async () => {
          dependencies.rateLimits.payment(req);
          const user = dependencies.auth.verifyUserAccess(req);
          await handle(res, 'payment', async () => {
            setRequestProvider('firestore');
            sendJson(res, 200, { entitlements: await dependencies.payments.listEntitlements(user) });
          });
        });
        return;
      }

      if (method === 'POST' && isPath(url.pathname, '/payments/portone/entitlement/renew')) {
        await handle(res, 'generic', async () => {
          dependencies.rateLimits.payment(req);
          const user = dependencies.auth.verifyUserAccess(req);
          const body = (await readJsonBody(req)) as Record<string, unknown>;
          recordUntrustedRequestAttributes(body);
          await handle(res, 'payment', async () => {
            setRequestProvider('firestore');
            sendJson(res, 200, await dependencies.payments.renew(user, body));
          });
        });
        return;
      }

      if (method === 'POST' && isPath(url.pathname, '/auth/kakao/exchange')) {
        await handle(res, 'auth', async () => {
          dependencies.rateLimits.auth(req);
          const body = (await readJsonBody(req)) as Record<string, unknown>;
          setRequestProvider('kakao');
          sendJson(res, 200, await dependencies.kakao.exchange(body));
        });
        return;
      }

      if (method === 'GET' && isPath(url.pathname, '/archive/reports')) {
        await handle(res, 'generic', async () => {
          dependencies.rateLimits.report(req);
          const user = dependencies.auth.verifyUserAccess(req);
          await handle(res, 'archive-storage', async () => {
            setRequestProvider('firestore');
            sendJson(res, 200, {
              entries: await dependencies.archives.list(user.userId),
              storage: 'firestore'
            });
          });
        });
        return;
      }

      if (method === 'POST' && isPath(url.pathname, '/archive/reports')) {
        await handle(res, 'archive', async () => {
          dependencies.rateLimits.report(req);
          const user = dependencies.auth.verifyUserAccess(req);
          const body = (await readJsonBody(req)) as Record<string, unknown>;
          recordUntrustedRequestAttributes(body);
          const entry = await dependencies.archives.save(user.userId, body);
          setRequestProvider('firestore');
          sendJson(res, 200, {
            ok: true,
            entry
          });
        });
        return;
      }

      if (method === 'POST' && isPath(url.pathname, '/admin/login')) {
        await handle(res, 'admin', async () => {
          dependencies.rateLimits.admin(req);
          const body = (await readJsonBody(req)) as Record<string, unknown>;
          sendJson(res, 200, dependencies.admin.login(body));
        });
        return;
      }

      if (method === 'GET' && isPath(url.pathname, '/admin/reports')) {
        await handle(res, 'admin', async () => {
          dependencies.rateLimits.admin(req);
          dependencies.auth.verifyAdminAccess(req);
          await handle(res, 'archive-storage', async () => {
            setRequestProvider('firestore');
            sendJson(res, 200, {
              entries: await dependencies.archives.list(),
              storage: 'firestore'
            });
          });
        });
        return;
      }

      sendPublicError(res, 404, PUBLIC_ERROR_CODES.RESOURCE_NOT_FOUND);
    } catch (error) {
      if (!res.writableEnded) {
        sendApiError(res, error, 'generic');
      }
    }
  };
}
