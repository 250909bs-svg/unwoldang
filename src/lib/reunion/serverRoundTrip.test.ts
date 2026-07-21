import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildAnalysisRequestPayload } from '../analysisPayload';
import {
  assertCommercialReportRequest,
  generateGeminiSajuReport,
  toFormData
} from '../server/geminiReportService';
import { createReunionSampleInput } from './fixtures';

describe('reunion paid-report round trip', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  it('preserves the versioned reunion context through the client/server payload', () => {
    const input = createReunionSampleInput();
    const payload = buildAnalysisRequestPayload('love-reunion', input);
    const restored = toFormData({
      serviceId: 'love-reunion',
      payload
    });

    expect(payload.reunion).toEqual(input.reunion);
    expect(restored.reunion).toEqual(input.reunion);
    expect(() => assertCommercialReportRequest('love-reunion', restored)).not.toThrow();
  });

  it('does not attach reunion context to another product request', () => {
    const input = createReunionSampleInput();
    const payload = buildAnalysisRequestPayload('love-reading', input);

    expect(payload.reunion).toBeNull();
  });

  it('rejects a paid reunion request when its structured intake is missing', () => {
    const input = createReunionSampleInput();
    const payload = buildAnalysisRequestPayload('love-reunion', input);
    const restored = toFormData({
      serviceId: 'love-reunion',
      payload: {
        ...payload,
        reunion: null
      }
    });

    expect(() => assertCommercialReportRequest('love-reunion', restored)).toThrow(
      /7\uB2E8\uACC4/
    );
  });
  it('stores the deterministic reunion strategy in the canonical server report', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('KASI_SERVICE_KEY', '');
    vi.stubEnv('DATA_GO_KR_SERVICE_KEY', '');
    vi.stubEnv('PUBLIC_DATA_SERVICE_KEY', '');

    const input = createReunionSampleInput();
    const payload = buildAnalysisRequestPayload('love-reunion', input);
    const response = await generateGeminiSajuReport({
      serviceId: 'love-reunion',
      payload
    });

    expect(response.provider).toBe('deterministic-fallback');
    expect(response.report.reunionStrategy).toMatchObject({
      version: 'reunion-report-v1.0.0',
      ruleVersion: 'reunion-policy-2026.07',
      customerName: input.name
    });
    expect(response.report.reunionStrategy?.metrics).toHaveLength(14);
  });
});
