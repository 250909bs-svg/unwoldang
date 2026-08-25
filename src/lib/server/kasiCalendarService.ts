import type { IntakeFormData } from '../../api/mockData';

type EnvRecord = Record<string, string | undefined>;
type Calendar = IntakeFormData['calendar'];

type KasiApiItem = Record<string, string | number | undefined>;

export type KasiSolarTerm = {
  name: string;
  date: string;
};

export type KasiCapabilityVerification = {
  enabled: boolean;
  status: 'disabled' | 'verified' | 'failed' | 'skipped';
  message: string;
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
  lunarCalendarVerification: KasiCapabilityVerification;
  solarTermVerification: KasiCapabilityVerification;
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
const DEFAULT_KASI_REQUEST_TIMEOUT_MS = 5000;

function getEnv() {
  const maybeProcess = globalThis as {
    process?: {
      env?: EnvRecord;
    };
  };

  return maybeProcess.process?.env ?? {};
}

function firstConfiguredKey(...values: Array<string | undefined>) {
  return values.map((value) => value?.trim() || '').find(Boolean) || '';
}

function getLegacyKasiServiceKey(env: EnvRecord) {
  return firstConfiguredKey(
    env.KASI_SERVICE_KEY,
    env.DATA_GO_KR_SERVICE_KEY,
    env.PUBLIC_DATA_SERVICE_KEY
  );
}

function getKasiLunarServiceKey(env: EnvRecord) {
  return firstConfiguredKey(env.KASI_LUNAR_SERVICE_KEY, getLegacyKasiServiceKey(env));
}

function getKasiSpecialDayServiceKey(env: EnvRecord) {
  return firstConfiguredKey(env.KASI_SPECIALDAY_SERVICE_KEY, getLegacyKasiServiceKey(env));
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

function encodeServiceKeyForQuery(serviceKey: string) {
  const trimmed = serviceKey.trim();

  try {
    // data.go.kr exposes both a decoded key and an already URL-encoded key.
    // Canonicalizing one layer lets both forms produce the same query value
    // without turning `%2B` into `%252B`.
    return encodeURIComponent(decodeURIComponent(trimmed));
  } catch {
    return encodeURIComponent(trimmed);
  }
}

function buildKasiUrl(endpoint: string, method: string, serviceKey: string, params: Record<string, string | number>) {
  const query = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])),
    _type: 'json',
    numOfRows: '100'
  });

  const encodedKey = encodeServiceKeyForQuery(serviceKey);
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
  if (resultCode && String(resultCode) !== '00') {
    throw new Error(response.response?.header?.resultMsg || `KASI API error ${resultCode}`);
  }

  const item = response.response?.body?.items?.item;

  if (!item) {
    return [];
  }

  return Array.isArray(item) ? item : [item];
}

function decodeXmlText(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function xmlTagValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!match) {
    return undefined;
  }

  const cdata = match[1].match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/i);
  return decodeXmlText(cdata ? cdata[1] : match[1]);
}

function xmlItemList(xml: string): KasiApiItem[] {
  const resultCode = xmlTagValue(xml, 'resultCode') || xmlTagValue(xml, 'returnReasonCode');
  const resultMessage = xmlTagValue(xml, 'resultMsg')
    || xmlTagValue(xml, 'resultMag')
    || xmlTagValue(xml, 'returnAuthMsg')
    || xmlTagValue(xml, 'errMsg');

  if (resultCode && resultCode !== '00' && resultCode !== '0') {
    throw new Error(resultMessage || `KASI API error ${resultCode}`);
  }

  const blocks = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
  return blocks.map((block) => {
    const item: KasiApiItem = {};
    const leafTag = /<([A-Za-z][\w.-]*)(?:\s[^>]*)?>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/\1>/gi;
    let match: RegExpExecArray | null;

    while ((match = leafTag.exec(block)) !== null) {
      item[match[1]] = decodeXmlText(match[2] ?? match[3] ?? '');
    }

    return item;
  });
}

function parseKasiItems(text: string) {
  const trimmed = text.replace(/^\uFEFF/, '').trim();

  if (trimmed.startsWith('<')) {
    return xmlItemList(trimmed);
  }

  try {
    return itemList(JSON.parse(trimmed));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('KASI API returned an unsupported response. Check the service key, API approval, and response format.');
    }

    throw error;
  }
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

    throw new Error('KASI API network request failed.');
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`KASI API request failed: ${response.status}`);
  }

  return parseKasiItems(text);
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

  const matched = items.find((item) => isLeapMatch(item, isLeapMonth));
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

function errorMessage(error: unknown, fallback: string, serviceKey: string) {
  const raw = error instanceof Error ? error.message : fallback;
  const encodedKey = encodeServiceKeyForQuery(serviceKey);
  return [serviceKey.trim(), encodedKey]
    .filter(Boolean)
    .reduce((message, secret) => message.split(secret).join('[REDACTED]'), raw)
    .replace(/([?&]ServiceKey=)[^&\s]+/gi, '$1[REDACTED]');
}

function disabledCapability(message: string): KasiCapabilityVerification {
  return { enabled: false, status: 'disabled', message };
}

function skippedCapability(message: string): KasiCapabilityVerification {
  return { enabled: true, status: 'skipped', message };
}

async function verifySolarTerms(
  date: { year: number; month: number; day: number },
  serviceKey: string
): Promise<{ verification: KasiCapabilityVerification; solarTerms?: KasiSolarTerm[] }> {
  if (!serviceKey) {
    return {
      verification: disabledCapability(
        'KASI_SPECIALDAY_SERVICE_KEY is not configured. Internal sxtwl solar-term calculation remains active.'
      )
    };
  }

  try {
    return {
      verification: {
        enabled: true,
        status: 'verified',
        message: 'KASI special-day API returned solar-term dates for the normalized solar month.'
      },
      solarTerms: await getSolarTermsForMonth(date.year, date.month, serviceKey)
    };
  } catch (error) {
    return {
      verification: {
        enabled: true,
        status: 'failed',
        message: errorMessage(
          error,
          'KASI special-day verification failed. Internal sxtwl solar-term calculation remains active.',
          serviceKey
        )
      }
    };
  }
}

export async function normalizeFormDataWithKasi(formData: Partial<IntakeFormData>) {
  const env = getEnv();
  const lunarServiceKey = getKasiLunarServiceKey(env);
  const specialDayServiceKey = getKasiSpecialDayServiceKey(env);
  const originalCalendar = formData.calendar === 'lunar' ? 'lunar' : 'solar';
  const originalBirthDate = formData.birthDate || '';
  const originalIsLeapMonth = Boolean(formData.isLeapMonth);
  const parsedDate = parseBirthDate(originalBirthDate);

  if (!parsedDate) {
    const lunarCalendarVerification: KasiCapabilityVerification = lunarServiceKey
      ? { enabled: true, status: 'failed', message: 'Birth date could not be parsed.' }
      : disabledCapability('KASI_LUNAR_SERVICE_KEY is not configured.');
    return {
      formData,
      verification: {
        provider: 'KASI',
        enabled: lunarCalendarVerification.enabled,
        status: lunarCalendarVerification.status === 'failed' ? 'failed' : 'disabled',
        message: lunarCalendarVerification.message,
        originalCalendar,
        originalBirthDate,
        originalIsLeapMonth,
        normalizedCalendar: originalCalendar,
        lunarCalendarVerification,
        solarTermVerification: specialDayServiceKey
          ? skippedCapability('Solar-term verification was skipped because the birth date is invalid.')
          : disabledCapability('KASI_SPECIALDAY_SERVICE_KEY is not configured.')
      } satisfies KasiCalendarVerification
    };
  }

  if (originalCalendar === 'lunar') {
    if (!lunarServiceKey) {
      const lunarCalendarVerification = disabledCapability(
        'KASI_LUNAR_SERVICE_KEY is not configured. Lunar-to-solar conversion is unavailable.'
      );
      return {
        formData,
        verification: {
          provider: 'KASI', enabled: false, status: 'disabled',
          message: lunarCalendarVerification.message,
          originalCalendar, originalBirthDate, originalIsLeapMonth,
          normalizedCalendar: originalCalendar,
          lunarCalendarVerification,
          solarTermVerification: specialDayServiceKey
            ? skippedCapability('Solar-term verification requires a successful lunar-to-solar conversion first.')
            : disabledCapability('KASI_SPECIALDAY_SERVICE_KEY is not configured.')
        } satisfies KasiCalendarVerification
      };
    }

    try {
      const solar = await getSolarFromLunar(parsedDate, originalIsLeapMonth, lunarServiceKey);
      if (!solar.solarDate) {
        throw new Error('KASI lunar-to-solar conversion returned no solar date.');
      }

      const convertedDate = parseBirthDate(solar.solarDate);
      const solarTermResult = convertedDate
        ? await verifySolarTerms(convertedDate, specialDayServiceKey)
        : {
            verification: specialDayServiceKey
              ? skippedCapability('Solar-term verification requires a normalized solar date.')
              : disabledCapability('KASI_SPECIALDAY_SERVICE_KEY is not configured.')
          };
      const lunarCalendarVerification: KasiCapabilityVerification = {
        enabled: true,
        status: 'verified',
        message: 'Lunar birth date was normalized to a solar date with the KASI lunar-calendar API.'
      };

      return {
        formData: {
          ...formData, calendar: 'solar' as const, isLeapMonth: false, birthDate: solar.solarDate
        },
        verification: {
          provider: 'KASI', enabled: true, status: 'verified',
          message: lunarCalendarVerification.message,
          originalCalendar, originalBirthDate, originalIsLeapMonth,
          normalizedCalendar: 'solar',
          normalizedSolarDate: solar.solarDate,
          lunar: solar.lunar,
          lunarCalendarVerification,
          solarTermVerification: solarTermResult.verification,
          solarTerms: solarTermResult.solarTerms
        } satisfies KasiCalendarVerification
      };
    } catch (error) {
      const lunarCalendarVerification: KasiCapabilityVerification = {
        enabled: true,
        status: 'failed',
        message: errorMessage(error, 'KASI lunar-to-solar conversion failed.', lunarServiceKey)
      };
      return {
        formData,
        verification: {
          provider: 'KASI', enabled: true, status: 'failed',
          message: lunarCalendarVerification.message,
          originalCalendar, originalBirthDate, originalIsLeapMonth,
          normalizedCalendar: originalCalendar,
          lunarCalendarVerification,
          solarTermVerification: specialDayServiceKey
            ? skippedCapability('Solar-term verification requires a successful lunar-to-solar conversion first.')
            : disabledCapability('KASI_SPECIALDAY_SERVICE_KEY is not configured.')
        } satisfies KasiCalendarVerification
      };
    }
  }

  let lunar: ReturnType<typeof lunarMetaFromItem>;
  let lunarCalendarVerification: KasiCapabilityVerification;
  if (!lunarServiceKey) {
    lunarCalendarVerification = disabledCapability(
      'KASI_LUNAR_SERVICE_KEY is not configured. Solar-to-lunar cross-check is unavailable.'
    );
  } else {
    try {
      lunar = await getLunarFromSolar(parsedDate, lunarServiceKey);
      lunarCalendarVerification = {
        enabled: true,
        status: 'verified',
        message: 'Solar birth date was cross-checked with the KASI lunar-calendar API.'
      };
    } catch (error) {
      lunarCalendarVerification = {
        enabled: true,
        status: 'failed',
        message: errorMessage(error, 'KASI solar-to-lunar cross-check failed.', lunarServiceKey)
      };
    }
  }

  const solarTermResult = await verifySolarTerms(parsedDate, specialDayServiceKey);
  const status = lunarCalendarVerification.status === 'verified'
    ? 'verified'
    : lunarCalendarVerification.status === 'failed'
      ? 'failed'
      : 'disabled';

  return {
    formData,
    verification: {
      provider: 'KASI',
      enabled: lunarCalendarVerification.enabled,
      status,
      message: lunarCalendarVerification.message,
      originalCalendar, originalBirthDate, originalIsLeapMonth,
      normalizedCalendar: 'solar',
      normalizedSolarDate: originalBirthDate,
      lunar,
      lunarCalendarVerification,
      solarTermVerification: solarTermResult.verification,
      solarTerms: solarTermResult.solarTerms
    } satisfies KasiCalendarVerification
  };
}
