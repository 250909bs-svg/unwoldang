import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SajuReportData } from './saju/report';
import { requestAiReport } from './aiReport';

const report = {
  title: '테스트 리포트',
  summary: { title: '요약', analysis: [], advice: [] },
  sections: []
} as unknown as SajuReportData;

const formData = {
  name: '테스트',
  gender: 'female' as const,
  calendar: 'solar' as const,
  birthDate: '1992-09-09',
  birthTime: '10:24',
  isUnknownTime: false,
  q1: '첫 질문',
  q2: '둘째 질문'
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requestAiReport', () => {
  it('preserves deterministic fallback provider metadata', async () => {
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ report, provider: 'deterministic-fallback' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );

    const result = await requestAiReport('general-signature', formData, {
      orderId: 'UW-test-order',
      reportAccessToken: 'report-token'
    });

    expect(result).toMatchObject({
      report,
      provider: 'deterministic-fallback',
      degraded: true,
      schemaVersion: 'report-response-v1',
      generationMeta: {
        schemaVersion: 'report-generation-meta-v1',
        provider: 'deterministic-fallback',
        fallback: true,
        currency: 'USD'
      }
    });
  });

  it('retries an in-progress generation and returns the cached completion', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 'REPORT_GENERATION_IN_PROGRESS',
            message: 'Report generation is already in progress for this payment.'
          }),
          { status: 409, headers: { 'Retry-After': '0.001', 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ report, provider: 'gemini' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestAiReport('general-signature', formData, {
      orderId: 'UW-test-order',
      reportAccessToken: 'report-token'
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result?.provider).toBe('gemini');
    expect(result?.degraded).toBe(false);
    const sentRequest = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(sentRequest.schemaVersion).toBe('report-request-v1');
    expect(sentRequest).not.toHaveProperty('reportAccessToken');
  });

  it('does not retry a permanent input conflict', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'This payment is already bound to different report input.' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    vi.stubGlobal('fetch', fetchMock);

    const error = await requestAiReport('general-signature', formData, {
      orderId: 'UW-test-order',
      reportAccessToken: 'report-token'
    }).catch((caught) => caught);
    expect(error).toMatchObject({
      code: 'REPORT_INPUT_CONFLICT',
      retryable: false,
      message: expect.stringContaining('different report input')
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('honors server retryable false for a normally transient status', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        code: 'REPORT_STORAGE_UNAVAILABLE',
        message: 'Storage requires operator action.',
        retryable: false
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    vi.stubGlobal('fetch', fetchMock);

    const error = await requestAiReport('general-signature', formData, {
      orderId: 'UW-test-order',
      reportAccessToken: 'report-token'
    }).catch((caught) => caught);

    expect(error).toMatchObject({
      code: 'REPORT_STORAGE_UNAVAILABLE',
      retryable: false
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps a server-authorized retry bounded for a normally fatal status', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        code: 'REPORT_INPUT_CONFLICT',
        message: 'Retry is temporarily allowed by the server.',
        retryable: true
      }), {
        status: 409,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '0.001'
        }
      })
    );
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    vi.stubGlobal('fetch', fetchMock);

    const error = await requestAiReport('general-signature', formData, {
      orderId: 'UW-test-order',
      reportAccessToken: 'report-token'
    }).catch((caught) => caught);

    expect(error).toMatchObject({
      code: 'REPORT_INPUT_CONFLICT',
      retryable: true
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('treats an unverified provider as degraded', async () => {
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ report }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );

    const result = await requestAiReport('general-signature', formData, {
      orderId: 'UW-test-order',
      reportAccessToken: 'report-token'
    });

    expect(result?.provider).toBeNull();
    expect(result?.degraded).toBe(true);
    expect(result?.generationMeta).toMatchObject({
      provider: 'unknown',
      fallback: true,
      fallbackReason: 'legacy-provider-missing'
    });
  });

  it('rejects a malformed success payload with a stable non-retryable code', async () => {
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ report: { title: 'broken' }, provider: 'gemini' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    ));

    const error = await requestAiReport('general-signature', formData, {
      orderId: 'UW-test-order',
      reportAccessToken: 'report-token'
    }).catch((caught) => caught);

    expect(error).toMatchObject({ code: 'REPORT_RESPONSE_INVALID', retryable: false });
  });
});
