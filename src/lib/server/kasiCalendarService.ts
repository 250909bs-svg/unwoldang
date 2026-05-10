import type { IntakeFormData } from '../../api/mockData';

type EnvRecord = Record<string, string | undefined>;
type Calendar = IntakeFormData['calendar'];

type KasiApiItem = Record<string, string | number | undefined>;

export type KasiSolarTerm = {
  name: string;
  date: string;
};

export type KasiCalendarVerification = {
  provider: 'KASI';
  enabled: boolean;
  status: 'disabled' | 'verified' | 'failed';
  message?: string;
  originalCalendar: Calendar;
  originalBirthDate: string;
  originalIsLeapMonth: boolean;
  normalizedCalendar: Calendar;
  normalizedSolarDate?: string;
  lunar?: {
    year?: string;
    month?: string;
    day?: string;
    leapMonth?: string;
    yearGanji?: string;
    monthGanji?: string;
    dayGanji?: string;
  };
  solarTerms?: KasiSolarTerm[];
};

const LRSR_ENDPOINT = 'https://apis.data.go.kr/B090041/openapi/service/LrsrCldInfoService';
const SPCDE_ENDPOINT = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService';
const DEFAULT_KASI_REQUEST_TIMEOUT_MS = 8000;

function getEnv() {
  const maybeProcess = globalThis as {
    process?: {
      env?: EnvRecord;
    };
  };

  return maybeProcess.process?.env ?? {};
}

function getKasiServiceKey() {
  const env = getEnv();
  return env.KASI_SERVICE_KEY || env.DATA_GO_KR_SERVICE_KEY || env.PUBLIC_DATA_SERVICE_KEY || '';
}

function getKasiRequestTimeoutMs() {
  const env = getEnv();
  const configured = Number(env.KASI_REQUEST_TIMEOUT_MS);

  if (Number.isFinite(configured) && configured >= 3000) {
    return configured;
  }

  return DEFAULT_KASI_REQUEST_TIMEOUT_MS;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

function parseBirthDate(value?: string) {
  if (!value) {
    return null;
  }

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return { year, month, day };
}

function twoDigit(value: string | number | undefined) {
  return String(value ?? '').padStart(2, '0');
}

function ymd(year: string | number | undefined, month: string | number | undefined, day: string | number | undefined) {
  if (!year || !month || !day) {
    return '';
  }

  return `${year}-${twoDigit(month)}-${twoDigit(day)}`;
}

function buildKasiUrl(endpoint: string, method: string, serviceKey: string, params: Record<string, string | number>) {
  const query = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])),
    _type: 'json',
    numOfRows: '100'
  });

  // Public data portal keys are often copied in an already encoded form.
  const encodedKey = serviceKey.includes('%') ? serviceKey : encodeURIComponent(serviceKey);
  return `${endpoint}/${method}?ServiceKey=${encodedKey}&${query.toString()}`;
}

function itemList(value: unknown): KasiApiItem[] {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const response = value as {
    response?: {
      header?: {
        resultCode?: string;
        resultMsg?: string;
      };
      body?: {
        items?: {
          item?: KasiApiItem | KasiApiItem[];
        };
      };
    };
  };

  const resultCode = response.response?.header?.resultCode;
  if (resultCode && resultCode !== '00') {
    throw new Error(response.response?.header?.resultMsg || `KASI API error ${resultCode}`);
  }

  const item = response.response?.body?.items?.item;

  if (!item) {
    return [];
  }

  return Array.isArray(item) ? item : [item];
}

async function requestKasiItems(endpoint: string, method: string, serviceKey: string, params: Record<string, string | number>) {
  const url = buildKasiUrl(endpoint, method, serviceKey, params);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getKasiRequestTimeoutMs());
  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json'
      },
      signal: controller.signal
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error('KASI API request timed out. Internal saju calendar engine was used.');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`KASI API request failed: ${response.status}`);
  }

  try {
    return itemList(JSON.parse(text));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('KASI API returned a non-JSON response. Check the service key and API approval.');
    }

    throw error;
  }
}

function isLeapMatch(item: KasiApiItem, expectedLeap: boolean) {
  const raw = String(item.lunLeapmonth ?? '').trim().toLowerCase();

  if (!raw) {
    return !expectedLeap;
  }

  const isLeap = ['y', 'yes', 'true', '1', 'leap', '윤', '윤달'].includes(raw);
  const isNormal = ['n', 'no', 'false', '0', 'normal', '평', '평달'].includes(raw);

  if (expectedLeap) {
    return isLeap;
  }

  return isNormal || !isLeap;
}

function lunarMetaFromItem(item?: KasiApiItem) {
  if (!item) {
    return undefined;
  }

  return {
    year: item.lunYear ? String(item.lunYear) : undefined,
    month: item.lunMonth ? twoDigit(item.lunMonth) : undefined,
    day: item.lunDay ? twoDigit(item.lunDay) : undefined,
    leapMonth: item.lunLeapmonth ? String(item.lunLeapmonth) : undefined,
    yearGanji: item.lunSecha ? String(item.lunSecha) : undefined,
    monthGanji: item.lunWolgeon ? String(item.lunWolgeon) : undefined,
    dayGanji: item.lunIljin ? String(item.lunIljin) : undefined
  };
}

async function getSolarFromLunar(date: { year: number; month: number; day: number }, isLeapMonth: boolean, serviceKey: string) {
  const items = await requestKasiItems(LRSR_ENDPOINT, 'getSolCalInfo', serviceKey, {
    lunYear: date.year,
    lunMonth: twoDigit(date.month),
    lunDay: twoDigit(date.day)
  });

  const matched = items.find((item) => isLeapMatch(item, isLeapMonth)) || items[0];
  const solarDate = matched ? ymd(matched.solYear, matched.solMonth, matched.solDay) : '';

  return {
    solarDate,
    lunar: lunarMetaFromItem(matched)
  };
}

async function getLunarFromSolar(date: { year: number; month: number; day: number }, serviceKey: string) {
  const items = await requestKasiItems(LRSR_ENDPOINT, 'getLunCalInfo', serviceKey, {
    solYear: date.year,
    solMonth: twoDigit(date.month),
    solDay: twoDigit(date.day)
  });

  return lunarMetaFromItem(items[0]);
}

async function getSolarTermsForMonth(year: number, month: number, serviceKey: string): Promise<KasiSolarTerm[]> {
  const items = await requestKasiItems(SPCDE_ENDPOINT, 'get24DivisionsInfo', serviceKey, {
    solYear: year,
    solMonth: twoDigit(month)
  });

  return items
    .map((item) => ({
      name: String(item.dateName || item.name || '').trim(),
      date: String(item.locdate || '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3')
    }))
    .filter((item) => item.name && item.date);
}

function disabledVerification(formData: Partial<IntakeFormData>): KasiCalendarVerification {
  return {
    provider: 'KASI',
    enabled: false,
    status: 'disabled',
    message: 'KASI_SERVICE_KEY is not configured. Internal saju calendar engine was used.',
    originalCalendar: formData.calendar === 'lunar' ? 'lunar' : 'solar',
    originalBirthDate: formData.birthDate || '',
    originalIsLeapMonth: Boolean(formData.isLeapMonth),
    normalizedCalendar: formData.calendar === 'lunar' ? 'lunar' : 'solar'
  };
}

export async function normalizeFormDataWithKasi(formData: Partial<IntakeFormData>) {
  const serviceKey = getKasiServiceKey();

  if (!serviceKey) {
    return {
      formData,
      verification: disabledVerification(formData)
    };
  }

  const originalCalendar = formData.calendar === 'lunar' ? 'lunar' : 'solar';
  const originalBirthDate = formData.birthDate || '';
  const originalIsLeapMonth = Boolean(formData.isLeapMonth);
  const parsedDate = parseBirthDate(originalBirthDate);

  if (!parsedDate) {
    return {
      formData,
      verification: {
        provider: 'KASI',
        enabled: true,
        status: 'failed',
        message: 'Birth date could not be parsed. Internal saju calendar engine was used.',
        originalCalendar,
        originalBirthDate,
        originalIsLeapMonth,
        normalizedCalendar: originalCalendar
      } satisfies KasiCalendarVerification
    };
  }

  try {
    if (originalCalendar === 'lunar') {
      const solar = await getSolarFromLunar(parsedDate, originalIsLeapMonth, serviceKey);

      if (!solar.solarDate) {
        throw new Error('KASI lunar-to-solar conversion returned no solar date.');
      }

      const convertedDate = parseBirthDate(solar.solarDate);
      const solarTerms = convertedDate
        ? await getSolarTermsForMonth(convertedDate.year, convertedDate.month, serviceKey)
        : [];

      return {
        formData: {
          ...formData,
          calendar: 'solar' as const,
          isLeapMonth: false,
          birthDate: solar.solarDate
        },
        verification: {
          provider: 'KASI',
          enabled: true,
          status: 'verified',
          message: 'Lunar birth date was normalized to a solar date with KASI before saju calculation.',
          originalCalendar,
          originalBirthDate,
          originalIsLeapMonth,
          normalizedCalendar: 'solar',
          normalizedSolarDate: solar.solarDate,
          lunar: solar.lunar,
          solarTerms
        } satisfies KasiCalendarVerification
      };
    }

    const lunar = await getLunarFromSolar(parsedDate, serviceKey);
    const solarTerms = await getSolarTermsForMonth(parsedDate.year, parsedDate.month, serviceKey);

    return {
      formData,
      verification: {
        provider: 'KASI',
        enabled: true,
        status: 'verified',
        message: 'Solar birth date was cross-checked with KASI lunar calendar data.',
        originalCalendar,
        originalBirthDate,
        originalIsLeapMonth,
        normalizedCalendar: 'solar',
        normalizedSolarDate: originalBirthDate,
        lunar,
        solarTerms
      } satisfies KasiCalendarVerification
    };
  } catch (error) {
    return {
      formData,
      verification: {
        provider: 'KASI',
        enabled: true,
        status: 'failed',
        message: error instanceof Error ? error.message : 'KASI verification failed. Internal saju calendar engine was used.',
        originalCalendar,
        originalBirthDate,
        originalIsLeapMonth,
        normalizedCalendar: originalCalendar
      } satisfies KasiCalendarVerification
    };
  }
}
