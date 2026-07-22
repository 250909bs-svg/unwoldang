import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import type { AuthenticatedUser, ReportAccessClaims } from '../contracts/auth.ts';
import {
  KakaoAuthError,
  PaymentRequestError,
  REPORT_ERROR_CODE,
  ReportPlatformError,
  ReportRequestError
} from '../contracts/errors.ts';
import {
  parseReportRequestV1,
  REPORT_REQUEST_SCHEMA_VERSION,
  ReportContractError,
  type ReportRequestV1,
  type ReportErrorCode
} from '../../../src/features/reports/contracts.ts';
import { readJsonBody } from './body.ts';
import { sendJson } from '../middleware/error.ts';

export const PUBLIC_ROUTES = Object.freeze([
  'GET /health',
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

type AuthMiddleware = {
  verifyUserAccess(req: IncomingMessage): AuthenticatedUser;
  verifyAdminAccess(req: IncomingMessage): unknown;
  assertReportAccess(
    req: IncomingMessage,
    body: Record<string, unknown>
  ): ReportAccessClaims | null;
};

type RouterDependencies = {
  applyCors(req: IncomingMessage, res: ServerResponse): void;
  enforceReportRateLimit(req: IncomingMessage): void;
  auth: AuthMiddleware;
  health: { getStatus(): unknown };
  reports: {
    generate(
      reportAccess: ReportAccessClaims | null,
      reportBody: Omit<ReportRequestV1, 'orderId'>
    ): Promise<unknown>;
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
  return pathname === barePath || pathname === `/api${barePath}`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function normalizeLegacyReportBody(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const raw = value as Record<string, unknown>;
  const { reportAccessToken: _transportToken, ...request } = raw;
  void _transportToken;
  if (Object.prototype.hasOwnProperty.call(raw, 'schemaVersion')) {
    return request;
  }

  // Before saju-report-request-v1, clients sent the opaque report token in the
  // body. Authentication still reads the raw body; only the contract parser
  // receives a copy without that transport-only legacy field.
  return { schemaVersion: REPORT_REQUEST_SCHEMA_VERSION, ...request };
}

function parseReportBody(value: unknown) {
  try {
    return parseReportRequestV1(normalizeLegacyReportBody(value));
  } catch (error) {
    if (error instanceof ReportContractError) {
      throw new ReportPlatformError({
        status: 400,
        code: REPORT_ERROR_CODE.INVALID_REQUEST,
        message: error.message,
        retryable: false,
        cause: error
      });
    }
    throw error;
  }
}

function normalizeReportRouteError(error: unknown) {
  if (error instanceof ReportPlatformError) return error;

  if (error instanceof ReportRequestError) {
    const status = error.status;
    let code: ReportErrorCode = 'REPORT_UNKNOWN_ERROR';
    let retryable = false;

    if (status === 400 || status === 413 || status === 422) {
      code = REPORT_ERROR_CODE.INVALID_REQUEST;
    } else if (status === 401) {
      code = REPORT_ERROR_CODE.ACCESS_REQUIRED;
    } else if (status === 403) {
      code = REPORT_ERROR_CODE.ACCESS_MISMATCH;
    } else if (status === 409) {
      code = REPORT_ERROR_CODE.ENTITLEMENT_INPUT_CONFLICT;
    } else if (status === 408) {
      code = 'REPORT_TIMEOUT';
      retryable = true;
    } else if (status === 429) {
      code = 'REPORT_RATE_LIMITED';
      retryable = true;
    } else if (status >= 500) {
      code = status === 502 || status === 503 || status === 504
        ? 'REPORT_PROVIDER_UNAVAILABLE'
        : 'REPORT_UNKNOWN_ERROR';
      retryable = true;
    }

    return new ReportPlatformError({
      status,
      code,
      message: error.message,
      retryable,
      cause: error
    });
  }

  return new ReportPlatformError({
    status: 500,
    code: REPORT_ERROR_CODE.GENERATION_FAILED,
    message: 'Report generation failed unexpectedly.',
    retryable: true,
    cause: error
  });
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

    if (req.method === 'POST' && isPath(url.pathname, '/report')) {
      try {
        dependencies.enforceReportRateLimit(req);
        const rawBody = await readJsonBody(req);
        const body = parseReportBody(rawBody);
        const reportAccess = dependencies.auth.assertReportAccess(
          req,
          rawBody as Record<string, unknown>
        );
        const { orderId, ...reportBody } = body;
        void orderId;
        const payload = await dependencies.reports.generate(reportAccess, reportBody);
        sendJson(res, 200, payload);
      } catch (error) {
        const reportError = normalizeReportRouteError(error);
        if (reportError.retryAfterSeconds !== undefined) {
          res.setHeader('Retry-After', String(reportError.retryAfterSeconds));
        }
        sendJson(res, reportError.status, {
          message: reportError.message,
          code: reportError.code,
          retryable: reportError.retryable,
          ...(reportError.retryAfterSeconds !== undefined
            ? { retryAfterSeconds: reportError.retryAfterSeconds }
            : {})
        });
      }
      return;
    }

    if (req.method === 'POST' && isPath(url.pathname, '/payments/portone/order')) {
      try {
        const user = dependencies.auth.verifyUserAccess(req);
        const body = (await readJsonBody(req)) as Record<string, unknown>;
        sendJson(res, 200, dependencies.payments.createOrder(user, body));
      } catch (error) {
        const status =
          error instanceof PaymentRequestError || error instanceof ReportRequestError
            ? error.status
            : 500;
        sendJson(res, status, {
          message: errorMessage(error, '결제 주문 인증 정보 발급 중 오류가 발생했습니다.')
        });
      }
      return;
    }

    if (req.method === 'POST' && isPath(url.pathname, '/payments/portone/confirm')) {
      try {
        const user = dependencies.auth.verifyUserAccess(req);
        const body = (await readJsonBody(req)) as Record<string, unknown>;
        sendJson(res, 200, await dependencies.payments.confirm(user, body));
      } catch (error) {
        const status =
          error instanceof PaymentRequestError || error instanceof ReportRequestError
            ? error.status
            : 500;
        sendJson(res, status, {
          message: errorMessage(error, 'PortOne 결제 검증 처리 중 오류가 발생했습니다.')
        });
      }
      return;
    }

    if (
      req.method === 'GET' &&
      isPath(url.pathname, '/payments/portone/entitlements')
    ) {
      try {
        const user = dependencies.auth.verifyUserAccess(req);
        sendJson(res, 200, {
          entitlements: await dependencies.payments.listEntitlements(user)
        });
      } catch (error) {
        const status =
          error instanceof PaymentRequestError || error instanceof ReportRequestError
            ? error.status
            : 500;
        sendJson(res, status, {
          message: errorMessage(error, '리포트 결제 권한 조회 중 오류가 발생했습니다.')
        });
      }
      return;
    }

    if (
      req.method === 'POST' &&
      isPath(url.pathname, '/payments/portone/entitlement/renew')
    ) {
      try {
        const user = dependencies.auth.verifyUserAccess(req);
        const body = (await readJsonBody(req)) as Record<string, unknown>;
        sendJson(res, 200, await dependencies.payments.renew(user, body));
      } catch (error) {
        const status =
          error instanceof PaymentRequestError || error instanceof ReportRequestError
            ? error.status
            : 500;
        sendJson(res, status, {
          message: errorMessage(error, '리포트 결제 권한 복구 중 오류가 발생했습니다.')
        });
      }
      return;
    }

    if (req.method === 'POST' && isPath(url.pathname, '/auth/kakao/exchange')) {
      try {
        const body = (await readJsonBody(req)) as Record<string, unknown>;
        sendJson(res, 200, await dependencies.kakao.exchange(body));
      } catch (error) {
        const status =
          error instanceof KakaoAuthError ||
          error instanceof PaymentRequestError ||
          error instanceof ReportRequestError
            ? error.status
            : 500;
        sendJson(res, status, {
          message: errorMessage(error, '카카오 로그인 처리 중 오류가 발생했습니다.')
        });
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
        sendJson(res, status, {
          message: errorMessage(error, '리포트 보관함 조회 중 오류가 발생했습니다.')
        });
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
        sendJson(res, status, {
          message: errorMessage(error, '리포트 보관함 저장 중 오류가 발생했습니다.')
        });
      }
      return;
    }

    if (req.method === 'POST' && isPath(url.pathname, '/admin/login')) {
      try {
        const body = (await readJsonBody(req)) as Record<string, unknown>;
        sendJson(res, 200, dependencies.admin.login(body));
      } catch (error) {
        const status =
          error instanceof ReportRequestError || error instanceof PaymentRequestError
            ? error.status
            : 500;
        sendJson(res, status, {
          message: errorMessage(error, '관리자 로그인 처리 중 오류가 발생했습니다.')
        });
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
        sendJson(res, status, {
          message: errorMessage(error, '관리자 리포트 조회 중 오류가 발생했습니다.')
        });
      }
      return;
    }

    sendJson(res, 404, {
      message: '지원하지 않는 경로입니다.',
      routes: PUBLIC_ROUTES
    });
  };
}
