import { describe, expect, it } from 'vitest';
import type { SajuReportData } from '../../lib/saju/report';
import {
  REPORT_GENERATION_META_SCHEMA_VERSION,
  REPORT_REQUEST_SCHEMA_VERSION,
  REPORT_RESPONSE_SCHEMA_VERSION
} from './contracts';
import {
  createReportHttpError,
  normalizeReportClientError,
  parseReportClientResult
} from './clientBoundary';

const report = {
  title: 'Boundary report',
  summary: { title: 'Summary', analysis: [], advice: [] },
  sections: []
} as unknown as SajuReportData;

describe('report client contract boundary', () => {
  it('preserves versioned server metadata without overwriting it with client timings', () => {
    const result = parseReportClientResult({
      schemaVersion: REPORT_RESPONSE_SCHEMA_VERSION,
      report,
      provider: 'gemini',
      generationMeta: {
        schemaVersion: REPORT_GENERATION_META_SCHEMA_VERSION,
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        latencyMs: 321,
        attemptCount: 2,
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
        estimatedCostMicros: 5,
        currency: 'USD',
        fallback: false,
        cacheStatus: 'hit',
        inputSchemaVersion: REPORT_REQUEST_SCHEMA_VERSION,
        responseSchemaVersion: REPORT_RESPONSE_SCHEMA_VERSION
      }
    }, { latencyMs: 999, attemptCount: 4 });

    expect(result.generationMeta).toMatchObject({ latencyMs: 321, attemptCount: 2, cacheStatus: 'hit' });
    expect(result.degraded).toBe(false);
  });

  it('adds safe client timing metadata to a legacy fallback envelope', () => {
    const result = parseReportClientResult(
      { report, provider: 'deterministic-fallback' },
      { latencyMs: 500, attemptCount: 3 }
    );
    expect(result.generationMeta).toMatchObject({ latencyMs: 500, attemptCount: 3, fallback: true });
    expect(result.degraded).toBe(true);
  });

  it('turns malformed responses into a non-retryable typed error', () => {
    expect(() => parseReportClientResult({ report: { title: 'broken' } }, { latencyMs: 1, attemptCount: 1 }))
      .toThrowError(expect.objectContaining({ code: 'REPORT_RESPONSE_INVALID', retryable: false }));
  });

  it('maps HTTP and transport failures to stable retry policies', () => {
    expect(createReportHttpError({ status: 409, message: 'different input' })).toMatchObject({
      code: 'REPORT_INPUT_CONFLICT',
      retryable: false
    });
    expect(createReportHttpError({
      status: 409,
      serverCode: 'REPORT_GENERATION_IN_PROGRESS',
      message: 'still running'
    })).toMatchObject({ code: 'REPORT_GENERATION_IN_PROGRESS', retryable: true });
    expect(createReportHttpError({
      status: 503,
      serverCode: 'REPORT_STORAGE_UNAVAILABLE',
      serverRetryable: false,
      message: 'operator action required'
    })).toMatchObject({ code: 'REPORT_STORAGE_UNAVAILABLE', retryable: false });
    expect(createReportHttpError({
      status: 409,
      serverCode: 'REPORT_INPUT_CONFLICT',
      serverRetryable: true,
      message: 'server-authorized retry'
    })).toMatchObject({ code: 'REPORT_INPUT_CONFLICT', retryable: true });
    expect(normalizeReportClientError(new TypeError('offline'))).toMatchObject({
      code: 'REPORT_NETWORK_ERROR',
      retryable: true
    });
  });
});
