import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestGeneralSignatureReleasePreflight } from './releasePreflight';

const formData = {
  name: '차민호',
  gender: 'male' as const,
  calendar: 'solar' as const,
  isLeapMonth: false,
  birthDate: '1992-09-09',
  birthTime: '10:24',
  isUnknownTime: false,
  birthTimePrecision: 'exact' as const,
  dayBoundaryPolicy: 'midnight' as const,
  relationshipStatus: 'dating' as const,
  relationshipDuration: 'under3' as const,
  location: '',
  q1: '사업을 시작해도 될까요?',
  q2: '사업 매출이 늘어도 돈이 남지 않는데 어떤 지출을 줄여야 하나요?'
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('general-signature release preflight client', () => {
  it('sends canonical intake data and accepts only the server decision', async () => {
    const fetchImplementation = vi.fn(async () => new Response(JSON.stringify({
      serviceId: 'general-signature',
      status: 'manual-review-required',
      reasons: ['출생시간 검토가 필요합니다.'],
      policyVersion: 'commercial-release-audit-v1.0.0',
      inputFingerprint: `uwi-${'a'.repeat(64)}`,
      calculationFingerprint: 'uw-fixture-calculation'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('window', { setTimeout, clearTimeout });

    const result = await requestGeneralSignatureReleasePreflight(formData, {
      endpoint: 'https://preflight.example/api/report/preflight',
      fetchImplementation: fetchImplementation as unknown as typeof fetch
    });

    expect(result.status).toBe('manual-review-required');
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImplementation.mock.calls[0];
    expect(url).toBe('https://preflight.example/api/report/preflight');
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      serviceId: 'general-signature',
      payload: {
        serviceId: 'general-signature',
        user: { name: '차민호', gender: 'male' },
        birth: {
          calendar: 'solar',
          isLeapMonth: false,
          date: '1992-09-09',
          time: '10:24',
          precision: 'exact'
        }
      }
    });
    expect(body).not.toHaveProperty('status');
    expect(body).not.toHaveProperty('calculationResult');
  });

  it('fails closed when the server response is not the preflight contract', async () => {
    vi.stubGlobal('window', { setTimeout, clearTimeout });

    await expect(requestGeneralSignatureReleasePreflight(formData, {
      endpoint: 'https://preflight.example/api/report/preflight',
      fetchImplementation: vi.fn(async () => new Response(JSON.stringify({
        status: 'auto-eligible'
      }), { status: 200 })) as unknown as typeof fetch
    })).rejects.toThrow('응답 형식이 올바르지 않습니다');
  });
});
