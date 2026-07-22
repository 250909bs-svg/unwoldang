import { describe, expect, it } from 'vitest';
import { buildAnalysisRequestPayload } from '../../lib/analysisPayload';
import type { SajuReportData } from '../../lib/saju/report';
import {
  REPORT_GENERATION_META_SCHEMA_VERSION,
  REPORT_REQUEST_SCHEMA_VERSION,
  REPORT_RESPONSE_SCHEMA_VERSION,
  ReportContractError,
  ReportGenerationError,
  createLegacyGenerationMeta,
  parseReportGenerationMetaV1,
  parseReportRequestV1,
  parseReportResponseV1,
  type ReportGenerationMetaV1
} from './contracts';

const report = {
  serviceId: 'general-signature',
  title: 'Contract report',
  summary: { title: 'Summary', analysis: [], advice: [] },
  sections: []
} as unknown as SajuReportData;

const meta = (overrides: Partial<ReportGenerationMetaV1> = {}): ReportGenerationMetaV1 => ({
  schemaVersion: REPORT_GENERATION_META_SCHEMA_VERSION,
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  latencyMs: 1200,
  attemptCount: 1,
  inputTokens: 100,
  outputTokens: 200,
  totalTokens: 300,
  estimatedCostMicros: 42,
  currency: 'USD',
  fallback: false,
  cacheStatus: 'miss',
  inputSchemaVersion: REPORT_REQUEST_SCHEMA_VERSION,
  responseSchemaVersion: REPORT_RESPONSE_SCHEMA_VERSION,
  engineVersion: 'myeongri-v2.0.0',
  adapterVersion: 'general-signature-adapter-v1',
  ...overrides
});

describe('versioned report contracts', () => {
  it('parses a versioned lunar/leap/boundary request without losing calculation inputs', () => {
    const payload = buildAnalysisRequestPayload('general-signature', {
      name: 'Contract user',
      gender: 'female',
      calendar: 'lunar',
      isLeapMonth: true,
      birthDate: '1992-04-12',
      birthTime: '23:30',
      isUnknownTime: false,
      birthTimePrecision: 'exact',
      dayBoundaryPolicy: 'late-zi',
      birthLocation: {
        label: 'Seoul',
        latitude: 37.5665,
        longitude: 126.978,
        timezone: 'Asia/Seoul',
        utcOffsetMinutes: 540,
        applySolarTimeCorrection: true
      },
      q1: 'First question',
      q2: 'Second question'
    });

    const parsed = parseReportRequestV1({
      schemaVersion: REPORT_REQUEST_SCHEMA_VERSION,
      serviceId: 'general-signature',
      orderId: 'UW-contract-order-00000001',
      payload,
      reportMode: 'premium-saju',
      promptVersion: 'prompt-v1'
    });

    expect(parsed.payload.birth).toMatchObject({
      calendar: 'lunar',
      isLeapMonth: true,
      time: '23:30',
      precision: 'exact',
      dayBoundaryPolicy: 'late-zi'
    });
    expect(parsed.payload.birth.location).toMatchObject({
      timezone: 'Asia/Seoul',
      applySolarTimeCorrection: true
    });
  });

  it('rejects mismatched service IDs and unversioned request bodies', () => {
    const payload = buildAnalysisRequestPayload('love-reading', {});
    expect(() => parseReportRequestV1({
      schemaVersion: REPORT_REQUEST_SCHEMA_VERSION,
      serviceId: 'general-signature',
      payload,
      reportMode: 'premium-saju',
      promptVersion: 'prompt-v1'
    })).toThrow(/must match/);
    expect(() => parseReportRequestV1({ serviceId: 'general-signature' })).toThrow(ReportContractError);
  });

  it('accepts only the privacy-safe generation metadata whitelist', () => {
    expect(parseReportGenerationMetaV1(meta())).toEqual(meta());
    expect(() => parseReportGenerationMetaV1({ ...meta(), name: 'must-not-leak' })).toThrow(/not allowed/);
    expect(() => parseReportGenerationMetaV1({ ...meta(), orderId: 'UW-secret' })).toThrow(/not allowed/);
    expect(() => parseReportGenerationMetaV1({ ...meta(), fallbackReason: 'customer asked about work' })).toThrow(
      /privacy-safe identifier/
    );
  });

  it('parses a strict versioned response and preserves all metadata', () => {
    const parsed = parseReportResponseV1({
      schemaVersion: REPORT_RESPONSE_SCHEMA_VERSION,
      report,
      provider: 'gemini',
      reportMode: 'premium-saju',
      promptVersion: 'prompt-v1',
      generationMeta: meta()
    });

    expect(parsed.schemaVersion).toBe(REPORT_RESPONSE_SCHEMA_VERSION);
    expect(parsed.generationMeta).toEqual(meta());
    expect(parsed.report).toBe(report);
  });

  it('normalizes legacy envelopes and raw reports into response-v1', () => {
    const envelope = parseReportResponseV1({ report, provider: 'deterministic-fallback' });
    const raw = parseReportResponseV1(report);

    expect(envelope.provider).toBe('deterministic-fallback');
    expect(envelope.generationMeta).toMatchObject({ fallback: true, fallbackReason: 'deterministic-fallback' });
    expect(raw.provider).toBe('unknown');
    expect(raw.generationMeta).toMatchObject({ fallback: true, fallbackReason: 'legacy-provider-missing' });
  });

  it('rejects malformed versioned responses and exposes typed retry information', () => {
    expect(() => parseReportResponseV1({
      schemaVersion: REPORT_RESPONSE_SCHEMA_VERSION,
      report: { title: 'Missing sections', summary: {} },
      provider: 'gemini',
      generationMeta: meta()
    })).toThrow(ReportContractError);

    expect(() => parseReportResponseV1({
      schemaVersion: REPORT_RESPONSE_SCHEMA_VERSION,
      report: {
        title: 'Invalid section entry',
        summary: { title: 'Summary', analysis: [], advice: [] },
        sections: [null]
      },
      provider: 'gemini',
      generationMeta: meta()
    })).toThrow(/report.sections.0/);

    const error = new ReportGenerationError({
      code: 'REPORT_GENERATION_IN_PROGRESS',
      message: 'Still running',
      retryable: true,
      status: 409,
      retryAfterMs: 3000
    });
    expect(error).toMatchObject({ code: 'REPORT_GENERATION_IN_PROGRESS', retryable: true, retryAfterMs: 3000 });
  });

  it('creates a complete safe metadata envelope for legacy providers', () => {
    expect(Object.keys(createLegacyGenerationMeta({ provider: 'gemini' })).sort()).toEqual([
      'attemptCount',
      'cacheStatus',
      'currency',
      'estimatedCostMicros',
      'fallback',
      'inputSchemaVersion',
      'inputTokens',
      'latencyMs',
      'model',
      'outputTokens',
      'provider',
      'responseSchemaVersion',
      'schemaVersion',
      'totalTokens'
    ]);
  });
});
