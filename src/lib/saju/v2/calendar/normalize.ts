import type { IntakeFormData } from '../../../../api/mockData';
import { parseCivilDate } from './dateMath';
import { parseBirthTime } from './timeParser';
import type { BirthContext, BirthContextOptions, BirthLocation } from './types';

const KOREA_TIMEZONE = 'Asia/Seoul';
const KST_OFFSET_MINUTES = 9 * 60;

function assertValidTimeZoneId(timezoneId: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezoneId }).format(new Date(0));
  } catch {
    throw new Error(`유효하지 않은 IANA 시간대입니다: ${timezoneId}`);
  }
}

function resolveUtcOffsetMinutes(options: BirthContextOptions, birthYear: number) {
  const timezoneId = options.timezoneId || KOREA_TIMEZONE;
  assertValidTimeZoneId(timezoneId);

  if (options.utcOffsetMinutes !== undefined) {
    return options.utcOffsetMinutes;
  }

  if (timezoneId === KOREA_TIMEZONE) {
    if (birthYear < 1962) {
      throw new Error(
        '1962년 이전 한국 출생은 역사적 표준시·서머타임 확인을 위해 출생 당시 UTC 오프셋을 반드시 입력해야 합니다.'
      );
    }
    return KST_OFFSET_MINUTES;
  }

  throw new Error(
    `해외 출생지(${timezoneId})는 출생 당시의 UTC 오프셋을 반드시 입력해야 합니다. ` +
    '일광절약시간과 과거 시간대 변경을 현재 오프셋으로 추측하지 않습니다.'
  );
}

function assertCoordinate(value: number | undefined, min: number, max: number, label: string) {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} 좌표가 허용 범위를 벗어났습니다.`);
  }
}

function buildLocation(formData: Partial<IntakeFormData>, options: BirthContextOptions): BirthLocation | null {
  assertCoordinate(options.latitude, -90, 90, '위도');
  assertCoordinate(options.longitude, -180, 180, '경도');

  const label = options.locationLabel?.trim() || formData.location?.trim() || undefined;
  const hasCoordinates = options.latitude !== undefined || options.longitude !== undefined;
  if (!label && !hasCoordinates) return null;

  return {
    label,
    latitude: options.latitude,
    longitude: options.longitude,
    source: options.longitude !== undefined ? 'verified-coordinates' : 'user-text'
  };
}

/**
 * Adapts the v1 intake model without guessing coordinates from a free-text city.
 * Korean births safely retain KST. True-solar correction defaults on only when
 * a verified numeric longitude is supplied by the caller.
 */
export function normalizeIntakeFormToBirthContext(
  formData: Partial<IntakeFormData>,
  options: BirthContextOptions = {}
): BirthContext {
  const calendar = formData.calendar === 'lunar' ? 'lunar' : 'solar';
  if (calendar === 'solar' && formData.isLeapMonth) {
    throw new Error('\uC724\uB2EC\uC740 \uC74C\uB825 \uC0DD\uB144\uC6D4\uC77C\uC5D0\uB9CC \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.');
  }
  const date = parseCivilDate(formData.birthDate, calendar);
  const location = buildLocation(formData, options);
  const hasExplicitTimezone = options.timezoneId !== undefined || options.utcOffsetMinutes !== undefined;
  const timezoneId = options.timezoneId || KOREA_TIMEZONE;
  const utcOffsetMinutes = resolveUtcOffsetMinutes(options, date.year);
  if (!Number.isFinite(utcOffsetMinutes) || utcOffsetMinutes < -14 * 60 || utcOffsetMinutes > 14 * 60) {
    throw new Error('UTC 오프셋은 -14:00부터 +14:00 사이여야 합니다.');
  }

  const applyTrueSolarTime = options.applyTrueSolarTime ?? location?.longitude !== undefined;

  return {
    name: formData.name?.trim() || '',
    gender: formData.gender === 'male' ? 'male' : 'female',
    calendar,
    isLeapMonth: Boolean(formData.isLeapMonth),
    date,
    time: parseBirthTime(formData.birthTime, Boolean(formData.isUnknownTime)),
    location,
    timezone: {
      id: timezoneId,
      utcOffsetMinutes,
      source: hasExplicitTimezone ? 'explicit' : 'korea-default'
    },
    trueSolarTime: {
      enabled: applyTrueSolarTime,
      includeEquationOfTime: options.includeEquationOfTime ?? true
    },
    dayBoundaryPolicy: options.dayBoundaryPolicy || 'civil-midnight'
  };
}
