import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { SERVER_PRODUCT_CATALOG } from '../contracts/products.ts';
import { defaultLogger, type StructuredLogger, type StructuredLogRecord } from './logger.ts';

type RequestContext = {
  requestId: string;
  route: string;
  startedAt: number;
  logger: StructuredLogger;
  errorCode?: string;
  productId?: string;
  orderHash?: string;
  provider?: string;
  degraded: boolean;
  completed: boolean;
};

const storage = new AsyncLocalStorage<RequestContext>();
const SAFE_REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function firstHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function resolveRequestId(req: IncomingMessage) {
  const supplied = firstHeaderValue(req.headers['x-request-id'])?.trim();
  return supplied && SAFE_REQUEST_ID.test(supplied) ? supplied : randomUUID();
}

export function hashOrderId(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }

  return `sha256:${createHash('sha256').update(`order:${value.trim()}`).digest('hex').slice(0, 16)}`;
}

function safeProductId(value: unknown) {
  return typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(SERVER_PRODUCT_CATALOG, value)
    ? value : undefined;
}

function safeProvider(value: unknown) {
  return (
    value === 'gemini' ||
    value === 'deterministic-fallback' ||
    value === 'portone' ||
    value === 'kakao' ||
    value === 'firestore'
  ) ? value : undefined;
}

function safeLog(logger: StructuredLogger, record: StructuredLogRecord) {
  try {
    logger.log(record);
  } catch {
    // Logging failures must not change request authorization or response behavior.
  }
}

export function getRequestContext() {
  return storage.getStore();
}

export function getRequestId() {
  return getRequestContext()?.requestId;
}

export function setRequestRoute(route: string) {
  const context = getRequestContext();

  if (!context) return;
  context.route = route;
}

export function setRequestProvider(provider: unknown) {
  const context = getRequestContext();
  const trustedProvider = safeProvider(provider);

  if (context && trustedProvider) {
    context.provider = trustedProvider;
  }
}

function getNestedEntry(payload: Record<string, unknown>) {
  return payload.entry && typeof payload.entry === 'object' && !Array.isArray(payload.entry)
    ? payload.entry as Record<string, unknown>
    : undefined;
}

/**
 * Request bodies are untrusted. Only a one-way order identifier hash may be
 * derived before domain validation succeeds.
 */
export function recordUntrustedRequestAttributes(value: unknown) {
  const context = getRequestContext();

  if (!context || !value || typeof value !== 'object' || Array.isArray(value)) return;
  const payload = value as Record<string, unknown>;
  const entry = getNestedEntry(payload);
  context.orderHash = hashOrderId(payload.orderId) ||
    hashOrderId(entry?.orderId) || context.orderHash;
}

/**
 * Only server-validated claims and server-generated response payloads may use
 * this path to enrich product/provider/degraded dimensions.
 */
export function recordTrustedRequestAttributes(value: unknown) {
  const context = getRequestContext();

  if (!context || !value || typeof value !== 'object' || Array.isArray(value)) return;
  const payload = value as Record<string, unknown>;
  const entry = getNestedEntry(payload);
  context.productId = safeProductId(payload.productId) ||
    safeProductId(entry?.productId) || context.productId;
  context.orderHash = hashOrderId(payload.orderId) ||
    hashOrderId(entry?.orderId) || context.orderHash;
  context.provider = safeProvider(payload.provider) || context.provider;

  if (typeof payload.degraded === 'boolean') {
    context.degraded = payload.degraded;
  } else if (safeProvider(payload.provider) === 'deterministic-fallback') {
    context.degraded = true;
  }
}

export function recordRequestError(errorCode: string) {
  const context = getRequestContext();

  if (context && /^[A-Z][A-Z0-9_]{0,79}$/.test(errorCode)) {
    context.errorCode = errorCode;
  }
}

export function logOperationalEvent(
  event: string,
  errorCode: string,
  severity: 'WARNING' | 'ERROR' = 'ERROR'
) {
  const context = getRequestContext();
  const logger = context?.logger || defaultLogger;

  safeLog(logger, {
    severity,
    event,
    requestId: context?.requestId,
    route: context?.route,
    errorCode,
    productId: context?.productId,
    orderHash: context?.orderHash,
    provider: context?.provider,
    degraded: context?.degraded
  });
}

export function runWithRequestContext(
  req: IncomingMessage,
  res: ServerResponse,
  handler: () => Promise<void> | void,
  logger: StructuredLogger = defaultLogger
) {
  const context: RequestContext = {
    requestId: resolveRequestId(req),
    route: 'UNMATCHED',
    startedAt: Date.now(),
    logger,
    degraded: false,
    completed: false
  };

  res.setHeader('X-Request-ID', context.requestId);

  const complete = (aborted = false) => {
    if (context.completed) return;
    context.completed = true;
    const status = aborted ? 499 : (res.statusCode || 500);

    safeLog(logger, {
      severity: status >= 500 ? 'ERROR' : status >= 400 ? 'WARNING' : 'INFO',
      event: 'http_request',
      requestId: context.requestId,
      route: context.route,
      status,
      latencyMs: Date.now() - context.startedAt,
      errorCode: context.errorCode,
      productId: context.productId,
      orderHash: context.orderHash,
      provider: context.provider,
      degraded: context.degraded
    });
  };

  res.once('finish', () => complete(false));
  res.once('close', () => complete(!res.writableFinished));

  storage.run(context, () => {
    void Promise.resolve(handler()).catch(() => {
      recordRequestError('INTERNAL_ERROR');

      if (!res.headersSent) {
        res.statusCode = 500;
        res.end();
      } else if (!res.writableEnded) {
        res.end();
      }
    });
  });
}
