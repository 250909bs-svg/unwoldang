import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntakeFormData } from '../../api/mockData';
import { normalizeFormDataWithKasi } from './kasiCalendarService';

const keyEnvNames = [
  'KASI_SERVICE_KEY',
  'DATA_GO_KR_SERVICE_KEY',
  'PUBLIC_DATA_SERVICE_KEY'
] as const;

const input: Partial<IntakeFormData> = {
  name: '검증',
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

function xmlResponse(body: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
    <response>
      <header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header>
      <body><items>${body}</items></body>
    </response>`, { status: 200, headers: { 'Content-Type': 'application/xml' } });
}

beforeEach(() => {
  keyEnvNames.forEach((name) => delete process.env[name]);
});

afterEach(() => {
  keyEnvNames.forEach((name) => delete process.env[name]);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('normalizeFormDataWithKasi', () => {
  it.each([
    ['decoding key', 'sample+/=', 'sample%2B%2F%3D'],
    ['encoding key', 'sample%2B%2F%3D', 'sample%2B%2F%3D']
  ])('accepts a data.go.kr %s without double URL encoding', async (_label, serviceKey, expectedQueryKey) => {
    process.env.KASI_SERVICE_KEY = serviceKey;
    const fetchMock = vi.fn(async (request: string | URL | Request) => {
      const url = String(request);
      if (url.includes('get24DivisionsInfo')) {
        return jsonResponse({ dateName: '백로', locdate: '19920907' });
      }
      return jsonResponse({
        lunYear: '1992', lunMonth: '08', lunDay: '13', lunLeapmonth: '평',
        lunSecha: '임신(壬申)', lunWolgeon: '기유(己酉)', lunIljin: '무자(戊子)'
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await normalizeFormDataWithKasi(input);

    expect(result.verification.status).toBe('verified');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mock.calls.forEach(([request]) => {
      const url = String(request);
      expect(url).toContain(`ServiceKey=${expectedQueryKey}`);
      expect(url).not.toContain('ServiceKey=sample%252B');
    });
  });

  it('parses the XML response format documented by data.go.kr', async () => {
    process.env.KASI_SERVICE_KEY = 'sample+/=';
    vi.stubGlobal('fetch', vi.fn(async (request: string | URL | Request) => {
      const url = String(request);
      if (url.includes('get24DivisionsInfo')) {
        return xmlResponse('<item><dateName><![CDATA[백로]]></dateName><locdate>19920907</locdate></item>');
      }
      return xmlResponse(`<item>
        <lunYear>1992</lunYear><lunMonth>08</lunMonth><lunDay>13</lunDay>
        <lunLeapmonth>평</lunLeapmonth><lunSecha>임신(壬申)</lunSecha>
        <lunWolgeon>기유(己酉)</lunWolgeon><lunIljin>무자(戊子)</lunIljin>
      </item>`);
    }));

    const result = await normalizeFormDataWithKasi(input);

    expect(result.verification).toMatchObject({
      status: 'verified',
      normalizedSolarDate: '1992-09-09',
      lunar: {
        year: '1992', month: '08', day: '13', leapMonth: '평',
        yearGanji: '임신(壬申)', monthGanji: '기유(己酉)', dayGanji: '무자(戊子)'
      },
      solarTerms: [{ name: '백로', date: '1992-09-07' }]
    });
  });

  it('returns a failed verification for an XML authentication error without leaking the key', async () => {
    process.env.KASI_SERVICE_KEY = 'do-not-print-this-key';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(`
      <OpenAPI_ServiceResponse><cmmMsgHeader>
        <returnReasonCode>30</returnReasonCode>
        <returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg>
      </cmmMsgHeader></OpenAPI_ServiceResponse>
    `, { status: 200 })));

    const result = await normalizeFormDataWithKasi(input);

    expect(result.verification).toMatchObject({
      status: 'failed', message: 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR'
    });
    expect(result.verification.message).not.toContain('do-not-print-this-key');
  });
});
