import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntakeFormData } from '../../api/mockData';
import { normalizeFormDataWithKasi } from './kasiCalendarService';

const keyEnvNames = [
  'KASI_LUNAR_SERVICE_KEY',
  'KASI_SPECIALDAY_SERVICE_KEY',
  'KASI_SERVICE_KEY',
  'DATA_GO_KR_SERVICE_KEY',
  'PUBLIC_DATA_SERVICE_KEY'
] as const;

const solarInput: Partial<IntakeFormData> = {
  name: '분리검증',
  gender: 'female',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '1992-09-09',
  birthTime: '09:36',
  isUnknownTime: false,
  relationshipStatus: 'single',
  relationshipDuration: '',
  location: '서울',
  q1: '질문 1',
  q2: '질문 2'
};

function jsonResponse(item: Record<string, string>) {
  return new Response(JSON.stringify({
    response: {
      header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
      body: { items: { item } }
    }
  }), { status: 200 });
}

function lunarItem(extra: Record<string, string> = {}) {
  return {
    lunYear: '1992',
    lunMonth: '08',
    lunDay: '13',
    lunLeapmonth: '평',
    lunSecha: '임신(壬申)',
    lunWolgeon: '기유(己酉)',
    lunIljin: '무자(戊子)',
    ...extra
  };
}

beforeEach(() => {
  keyEnvNames.forEach((name) => delete process.env[name]);
});

afterEach(() => {
  keyEnvNames.forEach((name) => delete process.env[name]);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('KASI split credentials', () => {
  it('uses and normalizes different keys independently for each endpoint', async () => {
    process.env.KASI_LUNAR_SERVICE_KEY = 'lunar+/=';
    process.env.KASI_SPECIALDAY_SERVICE_KEY = 'special%2B%2F%3D';
    const fetchMock = vi.fn(async (request: string | URL | Request) => {
      const url = String(request);
      if (url.includes('get24DivisionsInfo')) {
        expect(url).toContain('ServiceKey=special%2B%2F%3D');
        expect(url).not.toContain('lunar%2B%2F%3D');
        expect(url).not.toContain('special%252B');
        return jsonResponse({ dateName: '백로', locdate: '19920907' });
      }

      expect(url).toContain('ServiceKey=lunar%2B%2F%3D');
      expect(url).not.toContain('special%2B%2F%3D');
      return jsonResponse(lunarItem());
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await normalizeFormDataWithKasi(solarInput);

    expect(result.verification.status).toBe('verified');
    expect(result.verification.lunarCalendarVerification.status).toBe('verified');
    expect(result.verification.solarTermVerification.status).toBe('verified');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('prefers dedicated keys over a configured legacy fallback', async () => {
    process.env.KASI_LUNAR_SERVICE_KEY = 'dedicated-lunar';
    process.env.KASI_SPECIALDAY_SERVICE_KEY = 'dedicated-special';
    process.env.KASI_SERVICE_KEY = 'legacy-key';
    const fetchMock = vi.fn(async (request: string | URL | Request) => {
      const url = String(request);
      expect(url).not.toContain('legacy-key');
      if (url.includes('get24DivisionsInfo')) {
        expect(url).toContain('ServiceKey=dedicated-special');
        return jsonResponse({ dateName: '백로', locdate: '19920907' });
      }
      expect(url).toContain('ServiceKey=dedicated-lunar');
      return jsonResponse(lunarItem());
    });
    vi.stubGlobal('fetch', fetchMock);

    await normalizeFormDataWithKasi(solarInput);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps lunar conversion verified when the special-day key is absent', async () => {
    process.env.KASI_LUNAR_SERVICE_KEY = 'lunar-key';
    const fetchMock = vi.fn(async () => jsonResponse(lunarItem({
      solYear: '1992', solMonth: '09', solDay: '09'
    })));
    vi.stubGlobal('fetch', fetchMock);

    const result = await normalizeFormDataWithKasi({
      ...solarInput, calendar: 'lunar', birthDate: '1992-08-13'
    });

    expect(result.formData).toMatchObject({ calendar: 'solar', birthDate: '1992-09-09' });
    expect(result.verification.status).toBe('verified');
    expect(result.verification.lunarCalendarVerification.status).toBe('verified');
    expect(result.verification.solarTermVerification.status).toBe('disabled');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('verifies solar-term dates without a lunar key while leaving the solar form usable', async () => {
    process.env.KASI_SPECIALDAY_SERVICE_KEY = 'special-key';
    const fetchMock = vi.fn(async (request: string | URL | Request) => {
      expect(String(request)).toContain('get24DivisionsInfo');
      return jsonResponse({ dateName: '백로', locdate: '19920907' });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await normalizeFormDataWithKasi(solarInput);

    expect(result.formData).toEqual(solarInput);
    expect(result.verification.status).toBe('disabled');
    expect(result.verification.lunarCalendarVerification.status).toBe('disabled');
    expect(result.verification.solarTermVerification.status).toBe('verified');
    expect(result.verification.solarTerms).toEqual([{ name: '백로', date: '1992-09-07' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not downgrade a successful lunar conversion when special-day verification fails', async () => {
    process.env.KASI_LUNAR_SERVICE_KEY = 'lunar-key';
    process.env.KASI_SPECIALDAY_SERVICE_KEY = 'special-key';
    vi.stubGlobal('fetch', vi.fn(async (request: string | URL | Request) => {
      if (String(request).includes('get24DivisionsInfo')) {
        return new Response(`
          <OpenAPI_ServiceResponse><cmmMsgHeader>
            <returnReasonCode>30</returnReasonCode>
            <returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg>
          </cmmMsgHeader></OpenAPI_ServiceResponse>
        `, { status: 200 });
      }
      return jsonResponse(lunarItem({ solYear: '1992', solMonth: '09', solDay: '09' }));
    }));

    const result = await normalizeFormDataWithKasi({
      ...solarInput, calendar: 'lunar', birthDate: '1992-08-13'
    });

    expect(result.formData).toMatchObject({ calendar: 'solar', birthDate: '1992-09-09' });
    expect(result.verification.status).toBe('verified');
    expect(result.verification.solarTermVerification).toMatchObject({
      enabled: true,
      status: 'failed',
      message: 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR'
    });
  });

  it('keeps lunar input fail-closed and skips special-day calls when the lunar key is missing', async () => {
    process.env.KASI_SPECIALDAY_SERVICE_KEY = 'special-key';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await normalizeFormDataWithKasi({
      ...solarInput, calendar: 'lunar', birthDate: '1992-08-13'
    });

    expect(result.formData.calendar).toBe('lunar');
    expect(result.verification.status).toBe('disabled');
    expect(result.verification.lunarCalendarVerification.status).toBe('disabled');
    expect(result.verification.solarTermVerification.status).toBe('skipped');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps lunar input failed when the lunar endpoint rejects its key and never leaks it', async () => {
    process.env.KASI_LUNAR_SERVICE_KEY = 'private-lunar-key';
    process.env.KASI_SPECIALDAY_SERVICE_KEY = 'special-key';
    const fetchMock = vi.fn(async () => new Response(`
      <OpenAPI_ServiceResponse><cmmMsgHeader>
        <returnReasonCode>30</returnReasonCode>
        <returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg>
      </cmmMsgHeader></OpenAPI_ServiceResponse>
    `, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await normalizeFormDataWithKasi({
      ...solarInput, calendar: 'lunar', birthDate: '1992-08-13'
    });

    expect(result.verification.status).toBe('failed');
    expect(result.verification.solarTermVerification.status).toBe('skipped');
    expect(result.verification.message).toBe('SERVICE_KEY_IS_NOT_REGISTERED_ERROR');
    expect(JSON.stringify(result.verification)).not.toContain('private-lunar-key');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
