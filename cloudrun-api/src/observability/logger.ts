import { SERVER_PRODUCT_CATALOG } from '../contracts/products.ts';

export type LogSeverity = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';

export type StructuredLogRecord = {
  severity: LogSeverity;
  event: string;
  requestId?: string;
  route?: string;
  status?: number;
  latencyMs?: number;
  errorCode?: string;
  productId?: string;
  orderHash?: string;
  provider?: string;
  degraded?: boolean;
};

export type StructuredLogger = {
  log(record: StructuredLogRecord): void;
};

const LOG_SEVERITIES = new Set<LogSeverity>(['DEBUG', 'INFO', 'WARNING', 'ERROR']);
const LOG_EVENTS = new Set([
  'http_request',
  'report_cache_verification_failed',
  'report_lock_release_failed',
  'server_start',
  'server_error'
]);
const LOG_ROUTES = new Set([
  'GET /health',
  'GET /health/live',
  'GET /health/ready',
  'POST /api/report',
  'POST /api/payments/portone/order',
  'POST /api/payments/portone/confirm',
  'GET /api/payments/portone/entitlements',
  'POST /api/payments/portone/entitlement/renew',
  'POST /api/auth/kakao/exchange',
  'GET /api/archive/reports',
  'POST /api/archive/reports',
  'POST /api/admin/login',
  'GET /api/admin/reports',
  'OPTIONS /preflight',
  'UNMATCHED'
]);
const LOG_PROVIDERS = new Set([
  'gemini',
  'deterministic-fallback',
  'portone',
  'kakao',
  'firestore'
]);
const SAFE_CODE = /^[A-Z][A-Z0-9_]{0,79}$/;
const SAFE_REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_ORDER_HASH = /^sha256:[a-f0-9]{16}$/;

function safeSeverity(value: unknown): LogSeverity {
  return typeof value === 'string' && LOG_SEVERITIES.has(value as LogSeverity)
    ? value as LogSeverity
    : 'INFO';
}

function exactValue(value: unknown, allowlist: ReadonlySet<string>) {
  return typeof value === 'string' && allowlist.has(value) ? value : undefined;
}

function safeCode(value: unknown) {
  return typeof value === 'string' && SAFE_CODE.test(value) ? value : undefined;
}

function safeProduct(value: unknown) {
  return typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(SERVER_PRODUCT_CATALOG, value)
    ? value : undefined;
}

function finiteInteger(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : undefined;
}

/**
 * Serializes an explicit allowlist only. Request bodies, error objects, email,
 * tokens and other arbitrary values cannot enter the structured log envelope.
 */
export function sanitizeLogRecord(record: StructuredLogRecord) {
  const requestId = typeof record.requestId === 'string' && SAFE_REQUEST_ID.test(record.requestId)
    ? record.requestId
    : undefined;
  const route = exactValue(record.route, LOG_ROUTES);
  const productId = safeProduct(record.productId);
  const provider = exactValue(record.provider, LOG_PROVIDERS);

  return {
    severity: safeSeverity(record.severity),
    timestamp: new Date().toISOString(),
    event: exactValue(record.event, LOG_EVENTS) || 'invalid_event',
    ...(requestId ? { requestId } : {}),
    ...(route ? { route } : {}),
    ...(finiteInteger(record.status) !== undefined ? { status: finiteInteger(record.status) } : {}),
    ...(finiteInteger(record.latencyMs) !== undefined ? { latency: finiteInteger(record.latencyMs) } : {}),
    ...(safeCode(record.errorCode) ? { errorCode: safeCode(record.errorCode) } : {}),
    ...(productId ? { productId } : {}),
    ...(typeof record.orderHash === 'string' && SAFE_ORDER_HASH.test(record.orderHash)
      ? { orderHash: record.orderHash }
      : {}),
    ...(provider ? { provider } : {}),
    ...(typeof record.degraded === 'boolean' ? { degraded: record.degraded } : {})
  };
}

export function createConsoleLogger(
  write: (line: string) => void = (line) => console.log(line)
): StructuredLogger {
  return {
    log(record) {
      write(JSON.stringify(sanitizeLogRecord(record)));
    }
  };
}

export const defaultLogger = createConsoleLogger();
