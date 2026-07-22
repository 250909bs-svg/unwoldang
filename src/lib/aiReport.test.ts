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

    expect(result).toEqual({
      report,
      provider: 'deterministic-fallback',
      degraded: true
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

    const requestIds = fetchMock.mock.calls.map(([, init]) =>
      new Headers((init as RequestInit).headers).get('X-Request-ID')
    );
    expect(new Set(requestIds).size).toBe(2);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result?.provider).toBe('gemini');
    expect(result?.degraded).toBe(false);
  });

  it('does not retry or expose the raw message for a permanent input conflict', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'This payment is already bound to different report input.' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      requestAiReport('general-signature', formData, {
        orderId: 'UW-test-order',
        reportAccessToken: 'report-token'
      })
    ).rejects.toMatchObject({
      code: 'REPORT_GENERATION_FAILED',
      message: '리포트 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.'
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
  });
});
