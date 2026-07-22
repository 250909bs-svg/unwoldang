import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import {
  PUBLIC_ERROR_CODES,
  PUBLIC_ERROR_MESSAGES,
  ReportGenerationInProgressError,
  normalizePublicError
} from '../../../cloudrun-api/src/contracts/errors.ts';
import {
  sanitizeLogRecord,
  type StructuredLogRecord
} from '../../../cloudrun-api/src/observability/logger.ts';
import {
  hashOrderId,
  recordTrustedRequestAttributes,
  recordUntrustedRequestAttributes,
  resolveRequestId,
  runWithRequestContext,
  setRequestProvider,
  setRequestRoute
} from '../../../cloudrun-api/src/observability/requestContext.ts';

describe('Cloud Run observability safety contracts', () => {
  it('serializes only the approved structured-log fields', () => {
    const record = sanitizeLogRecord({
      severity: 'ERROR',
      event: 'http_request',
      requestId: '629aa0b8-01aa-4c4b-a66c-53fb6cbd37ea',
      route: 'POST /api/report',
      status: 503,
      latencyMs: 1_234,
      errorCode: 'REPORT_GENERATION_FAILED',
      productId: 'general-signature',
      orderHash: 'sha256:0123456789abcdef',
      provider: 'deterministic-fallback',
      degraded: true,
      name: 'fixture-name-do-not-log',
      email: 'private@example.invalid',
      token: 'secret-token',
      question: 'fixture-question-body-do-not-log'
    } as StructuredLogRecord & Record<string, unknown>);

    expect(record).toMatchObject({
      severity: 'ERROR',
      event: 'http_request',
      route: 'POST /api/report',
      status: 503,
      latency: 1_234,
      errorCode: 'REPORT_GENERATION_FAILED',
      productId: 'general-signature',
      orderHash: 'sha256:0123456789abcdef',
      provider: 'deterministic-fallback',
      degraded: true
    });

    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain('fixture-name-do-not-log');
    expect(serialized).not.toContain('private@example.invalid');
    expect(serialized).not.toContain('secret-token');
    expect(serialized).not.toContain('fixture-question-body-do-not-log');
  });

  it('rejects free-form severity, event, route, request, product, and provider dimensions', () => {
    const record = sanitizeLogRecord({
      severity: 'CRITICAL',
      event: 'customer@example.invalid login',
      requestId: 'customer@example.invalid',
      route: 'GET /private/customer@example.invalid',
      productId: 'toString',
      provider: 'attacker-provider',
      degraded: false
    } as unknown as StructuredLogRecord);

    expect(record).toMatchObject({
      severity: 'INFO',
      event: 'invalid_event',
      degraded: false
    });
    expect(record).not.toHaveProperty('requestId');
    expect(record).not.toHaveProperty('route');
    expect(record).not.toHaveProperty('productId');
    expect(record).not.toHaveProperty('provider');

    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain('customer@example.invalid');
    expect(serialized).not.toContain('toString');
    expect(serialized).not.toContain('attacker-provider');
    expect(serialized).not.toContain('CRITICAL');
  });
  it('preserves the exact server lifecycle events', () => {
    for (const event of ['server_start', 'server_error']) {
      const record = sanitizeLogRecord({
        severity: event === 'server_error' ? 'ERROR' : 'INFO',
        event
      });

      expect(record).toMatchObject({
        severity: event === 'server_error' ? 'ERROR' : 'INFO',
        event
      });
      expect(record.event).not.toBe('invalid_event');
    }
  });


  it('hashes order IDs deterministically without retaining the source value', () => {
    const orderId = 'UW-observability-fixture-order';
    const hashed = hashOrderId(orderId);

    expect(hashed).toMatch(/^sha256:[a-f0-9]{16}$/);
    expect(hashed).toBe(hashOrderId(orderId));
    expect(hashed).not.toContain(orderId);
  });

  it('separates nested archive request metadata from trusted response metadata', () => {
    const records: StructuredLogRecord[] = [];
    const listeners = new Map<string, () => void>();
    const request = { headers: {} } as IncomingMessage;
    const response = {
      statusCode: 200,
      writableFinished: true,
      setHeader() {},
      once(event: string, listener: () => void) {
        listeners.set(event, listener);
        return this;
      }
    } as unknown as ServerResponse;
    const orderId = 'UW-nested-archive-order';

    runWithRequestContext(
      request,
      response,
      () => {
        setRequestRoute('POST /api/archive/reports');
        setRequestProvider('firestore');
        recordUntrustedRequestAttributes({
          orderId,
          productId: 'love-reading',
          provider: 'deterministic-fallback',
          degraded: true,
          entry: {
            orderId,
            productId: 'love-reading',
            provider: 'deterministic-fallback',
            degraded: true
          }
        });
        recordTrustedRequestAttributes({
          entry: {
            orderId,
            productId: 'general-signature',
            provider: 'deterministic-fallback',
            degraded: true
          }
        });
        listeners.get('finish')?.();
      },
      {
        log(record) {
          records.push(record);
        }
      }
    );

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      route: 'POST /api/archive/reports',
      productId: 'general-signature',
      orderHash: hashOrderId(orderId),
      provider: 'firestore',
      degraded: false
    });
  });

  it('accepts UUID request IDs and replaces untrusted values', () => {
    const trusted = '629aa0b8-01aa-4c4b-a66c-53fb6cbd37ea';
    const accepted = resolveRequestId({
      headers: { 'x-request-id': trusted }
    } as IncomingMessage);
    const replaced = resolveRequestId({
      headers: { 'x-request-id': 'private-user-name-or-log-injection' }
    } as IncomingMessage);

    expect(accepted).toBe(trusted);
    expect(replaced).toMatch(/^[0-9a-f-]{36}$/i);
    expect(replaced).not.toBe('private-user-name-or-log-injection');
  });

  it('maps internal failures to stable non-sensitive public messages', () => {
    const inProgress = normalizePublicError(
      new ReportGenerationInProgressError(),
      'report'
    );
    const paymentFailure = normalizePublicError(
      Object.assign(new Error('provider raw response must stay private'), { status: 502 }),
      'payment-confirmation'
    );

    expect(inProgress).toEqual({
      status: 409,
      errorCode: PUBLIC_ERROR_CODES.REPORT_GENERATION_IN_PROGRESS,
      message: PUBLIC_ERROR_MESSAGES.REPORT_GENERATION_IN_PROGRESS,
      retryAfterSeconds: 3
    });
    expect(paymentFailure).toEqual({
      status: 502,
      errorCode: PUBLIC_ERROR_CODES.PAYMENT_CONFIRMATION_FAILED,
      message: PUBLIC_ERROR_MESSAGES.PAYMENT_CONFIRMATION_FAILED
    });
    expect(JSON.stringify(paymentFailure)).not.toContain('provider raw response');
  });
});