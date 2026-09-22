import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import type { AuthenticatedUser, ReportAccessClaims } from '../contracts/auth.ts';
import { GuiyeondoRequestError, type GuiyeondoApi } from '../domains/guiyeondo/guiyeondoService.ts';
import {
  KakaoAuthError,
  PaymentRequestError,
  ReportGenerationInProgressError,
  ReportRequestError
} from '../contracts/errors.ts';
import { readJsonBody } from './body.ts';
import type { AdminLoginRateLimit } from '../middleware/adminLoginRateLimit.ts';
import { sendJson } from '../middleware/error.ts';
import { getClientIp } from '../middleware/rateLimit.ts';

export const PUBLIC_ROUTES = Object.freeze([
  'GET /health',
  'POST /api/report/preflight',
  'POST /report/preflight',
  'POST /api/report',
  'POST /report',
  'GET /api/coupons',
  'POST /api/coupons/claim',
  'POST /api/payments/portone/order',
  'POST /api/payments/portone/confirm',
  'GET /api/payments/portone/entitlements',
  'POST /api/payments/portone/entitlement/renew',
  'POST /api/auth/kakao/exchange',
  'GET /api/archive/reports',
  'POST /api/archive/reports',
  'POST /api/admin/login',
  'GET /api/admin/reports',
  'POST /api/guiyeondo/invites',
  'GET /api/guiyeondo/invites',
  'GET /api/guiyeondo/invites/:publicId',
  'POST /api/guiyeondo/invites/:publicId/responses',
  'GET /api/guiyeondo/invites/:publicId/responses',
  'POST /api/guiyeondo/invites/:publicId/revoke'
]);

type AuthMiddleware = {
  verifyUserAccess(req: IncomingMessage): AuthenticatedUser;
  verifyAdminAccess(req: IncomingMessage): unknown;
  assertReportAccess(req: IncomingMessage, body: Record<string, unknown>): ReportAccessClaims | null;
};

type RouterDependencies = {
  applyCors(req: IncomingMessage, res: ServerResponse): void;
  enforceReportRateLimit(req: IncomingMessage): void;
  adminLoginRateLimit: AdminLoginRateLimit;
  auth: AuthMiddleware;
  health: { getStatus(): unknown };
  reports: {
    generate(reportAccess: ReportAccessClaims | null, reportBody: Record<string, unknown>): Promise<unknown>;
  };
  releasePreflight: {
    evaluate(body: Record<string, unknown>): Promise<unknown>;
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
  guiyeondo: GuiyeondoApi;
  coupons: {
    listWallet(userId: string): Promise<unknown>;
    claim(userId: string, code: unknown): Promise<unknown>;
  };
};

function isPath(pathname: string, barePath: string) {
  return pathname === barePath || pathname === `/api${barePath}`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}


function guiyeondoPath(pathname: string) {
  const match = pathname.match(/^\/api\/guiyeondo\/invites\/([a-fA-F0-9]{32})(?:\/(responses|revoke))?$/);
  return match ? { publicId: match[1], action: match[2] || '' } : null;
}

function sendGuiyeondoError(res: ServerResponse, error: unknown) {
  if (error instanceof GuiyeondoRequestError) {
    sendJson(res, error.status, { message: error.message, code: error.code });
    return;
  }
  if (error instanceof ReportRequestError && (error.status === 401 || error.status === 403)) {
    sendJson(res, error.status, {
      message: error.status === 401 ? '카카오 로그인이 필요합니다.' : '이 귀연도를 관리할 권한이 없습니다.',
      code: error.status === 401 ? 'OWNER_LOGIN_REQUIRED' : 'OWNER_ACCOUNT_MISMATCH'
    });
    return;
  }
  if (error instanceof ReportRequestError && (error.status === 400 || error.status === 413)) {
    sendJson(res, error.status, { message: error.message, code: error.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INVALID_JSON' });
    return;
  }
  sendJson(res, 500, {
    message: '귀연도 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
  });
}

/**
 * 결제·쿠폰 오류 응답.
 *
 * `PaymentRequestError` 는 손님에게 보여도 되는 문구를 들고 온다(금액 불일치, 만료 등).
 * 그 밖의 오류는 메시지를 숨긴다 — 서버 내부 사정이 결제 화면에 새면 안 된다.
 */
function sendPaymentError(res: ServerResponse, error: unknown) {
  if (error instanceof PaymentRequestError) {
    sendJson(res, error.status, { message: error.message });
    return;
  }

  if (error instanceof ReportRequestError && (error.status === 401 || error.status === 403)) {
    sendJson(res, error.status, {
      message: error.status === 401 ? '카카오 로그인이 필요합니다.' : '권한이 없습니다.'
    });
    return;
  }

  if (error instanceof ReportRequestError && (error.status === 400 || error.status === 413)) {
    sendJson(res, error.status, { message: error.message });
    return;
  }

  sendJson(res, 500, { message: '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
}

export function createRouter(dependencies: RouterDependencies): RequestListener {
  return async (req, res) => {
    dependencies.applyCors(req, res);

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, dependencies.health.getStatus());
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/guiyeondo/invites') {
      try {
        const user = dependencies.auth.verifyUserAccess(req);
        const body = await readJsonBody(req);
        sendJson(res, 201, await dependencies.guiyeondo.createInvite(body, user.userId, getClientIp(req)));
      } catch (error) {
        sendGuiyeondoError(res, error);
      }
      return;
    }

    const guiyeondo = guiyeondoPath(url.pathname);

    if (req.method === 'GET' && url.pathname === '/api/guiyeondo/invites') {
      try {
        const user = dependencies.auth.verifyUserAccess(req);
        sendJson(res, 200, await dependencies.guiyeondo.listInvites(user.userId, getClientIp(req)));
      } catch (error) {
        sendGuiyeondoError(res, error);
      }
      return;
    }
    if (guiyeondo && req.method === 'GET' && !guiyeondo.action) {
      try {
        sendJson(res, 200, await dependencies.guiyeondo.getInvite(guiyeondo.publicId, getClientIp(req)));
      } catch (error) {
        sendGuiyeondoError(res, error);
      }
      return;
    }

    if (guiyeondo?.action === 'responses' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        sendJson(res, 201, await dependencies.guiyeondo.submitResponse(guiyeondo.publicId, body, getClientIp(req)));
      } catch (error) {
        sendGuiyeondoError(res, error);
      }
      return;
    }

    if (guiyeondo?.action === 'responses' && req.method === 'GET') {
      try {
        const user = dependencies.auth.verifyUserAccess(req);
        sendJson(res, 200, await dependencies.guiyeondo.listResponses(
          guiyeondo.publicId,
          user.userId,
          getClientIp(req)
        ));
      } catch (error) {
        sendGuiyeondoError(res, error);
      }
      return;
    }

    if (guiyeondo?.action === 'revoke' && req.method === 'POST') {
      try {
        const user = dependencies.auth.verifyUserAccess(req);
        sendJson(res, 200, await dependencies.guiyeondo.revokeInvite(
          guiyeondo.publicId,
          user.userId,
          getClientIp(req)
        ));
      } catch (error) {
        sendGuiyeondoError(res, error);
      }
      return;
    }

    if (req.method === 'POST' && isPath(url.pathname, '/report/preflight')) {
      try {
        dependencies.enforceReportRateLimit(req);
        const body = (await readJsonBody(req)) as Record<string, unknown>;
        sendJson(res, 200, await dependencies.releasePreflight.evaluate(body));
      } catch (error) {
        const status = error instanceof ReportRequestError ? error.status : 500;
        sendJson(res, status, {
          message: errorMessage(error, '종합사주 자동 발행 가능 여부를 확인하지 못했습니다.')
        });
      }
      return;
    }

    if (req.method === 'POST' && isPath(url.pathname, '/report')) {
      try {
        dependencies.enforceReportRateLimit(req);
        const body = (await readJsonBody(req)) as Record<string, unknown>;
        const reportAccess = dependencies.auth.assertReportAccess(req, body);
        const { reportAccessToken, orderId, ...reportBody } = body;
        void reportAccessToken;
        void orderId;
        const payload = await dependencies.reports.generate(reportAccess, reportBody);
        sendJson(res, 200, payload);
      } catch (error) {
        const status = error instanceof ReportRequestError ? error.status : 500;
        const message = errorMessage(error, 'Cloud Run 리포트 생성 중 오류가 발생했습니다.');

        if (error instanceof ReportGenerationInProgressError) {
          res.setHeader('Retry-After', String(error.retryAfterSeconds));
          sendJson(res, status, {
            message,
            code: error.code,
            retryAfterSeconds: error.retryAfterSeconds
          });
        } else {
          sendJson(res, status, { message });
        }
      }
      return;
    }

    /* 쿠폰 — 둘 다 로그인이 필요하다. 코드를 아는 것만으로 할인이 되면 코드가 새는
       순간 전원이 할인을 받으므로, 지갑에 든 쿠폰만 결제에 쓸 수 있다. */
    if (req.method === 'GET' && isPath(url.pathname, '/coupons')) {
      try {
        const user = dependencies.auth.verifyUserAccess(req);
        sendJson(res, 200, await dependencies.coupons.listWallet(user.userId));
      } catch (error) {
        sendPaymentError(res, error);
      }
      return;
    }

    if (req.method === 'POST' && isPath(url.pathname, '/coupons/claim')) {
      try {
        const user = dependencies.auth.verifyUserAccess(req);
        const body = await readJsonBody(req);
        sendJson(res, 200, await dependencies.coupons.claim(user.userId, body.code));
      } catch (error) {
        sendPaymentError(res, error);
      }
      return;
    }

    if (req.method === 'POST' && isPath(url.pathname, '/payments/portone/order')) {
      try {
        const user = dependencies.auth.verifyUserAccess(req);
        const body = (await readJsonBody(req)) as Record<string, unknown>;
        sendJson(res, 200, await dependencies.payments.createOrder(user, body));
      } catch (error) {
        const status = error instanceof PaymentRequestError || error instanceof ReportRequestError ? error.status : 500;
        sendJson(res, status, { message: errorMessage(error, '결제 주문 인증 정보 발급 중 오류가 발생했습니다.') });
      }
      return;
    }

    if (req.method === 'POST' && isPath(url.pathname, '/payments/portone/confirm')) {
      try {
        const user = dependencies.auth.verifyUserAccess(req);
        const body = (await readJsonBody(req)) as Record<string, unknown>;
        sendJson(res, 200, await dependencies.payments.confirm(user, body));
      } catch (error) {
        const status = error instanceof PaymentRequestError || error instanceof ReportRequestError ? error.status : 500;
        sendJson(res, status, { message: errorMessage(error, 'PortOne 결제 검증 처리 중 오류가 발생했습니다.') });
      }
      return;
    }

    if (req.method === 'GET' && isPath(url.pathname, '/payments/portone/entitlements')) {
      try {
        const user = dependencies.auth.verifyUserAccess(req);
        sendJson(res, 200, { entitlements: await dependencies.payments.listEntitlements(user) });
      } catch (error) {
        const status = error instanceof PaymentRequestError || error instanceof ReportRequestError ? error.status : 500;
        sendJson(res, status, { message: errorMessage(error, '리포트 결제 권한 조회 중 오류가 발생했습니다.') });
      }
      return;
    }

    if (req.method === 'POST' && isPath(url.pathname, '/payments/portone/entitlement/renew')) {
      try {
        const user = dependencies.auth.verifyUserAccess(req);
        const body = (await readJsonBody(req)) as Record<string, unknown>;
        sendJson(res, 200, await dependencies.payments.renew(user, body));
      } catch (error) {
        const status = error instanceof PaymentRequestError || error instanceof ReportRequestError ? error.status : 500;
        sendJson(res, status, { message: errorMessage(error, '리포트 결제 권한 복구 중 오류가 발생했습니다.') });
      }
      return;
    }

    if (req.method === 'POST' && isPath(url.pathname, '/auth/kakao/exchange')) {
      try {
        const body = (await readJsonBody(req)) as Record<string, unknown>;
        sendJson(res, 200, await dependencies.kakao.exchange(body));
      } catch (error) {
        const status =
          error instanceof KakaoAuthError || error instanceof PaymentRequestError || error instanceof ReportRequestError
            ? error.status
            : 500;
        sendJson(res, status, { message: errorMessage(error, '카카오 로그인 처리 중 오류가 발생했습니다.') });
      }
      return;
    }

    if (req.method === 'GET' && isPath(url.pathname, '/archive/reports')) {
      try {
        const user = dependencies.auth.verifyUserAccess(req);
        sendJson(res, 200, {
          entries: await dependencies.archives.list(user.userId),
          storage: 'firestore'
        });
      } catch (error) {
        const status = error instanceof ReportRequestError ? error.status : 500;
        sendJson(res, status, { message: errorMessage(error, '리포트 보관함 조회 중 오류가 발생했습니다.') });
      }
      return;
    }

    if (req.method === 'POST' && isPath(url.pathname, '/archive/reports')) {
      try {
        const user = dependencies.auth.verifyUserAccess(req);
        const body = (await readJsonBody(req)) as Record<string, unknown>;
        sendJson(res, 200, {
          ok: true,
          entry: await dependencies.archives.save(user.userId, body)
        });
      } catch (error) {
        const status = error instanceof ReportRequestError ? error.status : 500;
        sendJson(res, status, { message: errorMessage(error, '리포트 보관함 저장 중 오류가 발생했습니다.') });
      }
      return;
    }

    if (req.method === 'POST' && isPath(url.pathname, '/admin/login')) {
      try {
        dependencies.adminLoginRateLimit.assertAllowed(req);
        const body = (await readJsonBody(req)) as Record<string, unknown>;
        const result = dependencies.admin.login(body);
        dependencies.adminLoginRateLimit.reset(req);
        sendJson(res, 200, result);
      } catch (error) {
        if (error instanceof ReportRequestError && error.status === 401) dependencies.adminLoginRateLimit.recordFailure(req);
        const status = error instanceof ReportRequestError || error instanceof PaymentRequestError ? error.status : 500;
        sendJson(res, status, { message: errorMessage(error, '관리자 로그인 처리 중 오류가 발생했습니다.') });
      }
      return;
    }

    if (req.method === 'GET' && isPath(url.pathname, '/admin/reports')) {
      try {
        dependencies.auth.verifyAdminAccess(req);
        sendJson(res, 200, {
          entries: await dependencies.archives.list(),
          storage: 'firestore'
        });
      } catch (error) {
        const status = error instanceof ReportRequestError ? error.status : 500;
        sendJson(res, status, { message: errorMessage(error, '관리자 리포트 조회 중 오류가 발생했습니다.') });
      }
      return;
    }

    sendJson(res, 404, {
      message: '지원하지 않는 경로입니다.',
      routes: PUBLIC_ROUTES
    });
  };
}
