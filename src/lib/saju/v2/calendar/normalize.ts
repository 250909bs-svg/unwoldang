import type { IntakeFormData } from '../../../../api/mockData';
import { parseCivilDate } from './dateMath';
import { parseBirthTime } from './timeParser';
import {
  assertResolvableLocalDateTime,
  assertValidIanaTimeZone,
  resolveHistoricalUtcOffsetMinutes
} from './timeZoneValidation';
import type { BirthContext, BirthContextOptions, BirthLocation } from './types';

const KOREA_TIMEZONE = 'Asia/Seoul';
const KST_OFFSET_MINUTES = 9 * 60;

type ResolvedUtcOffset = {
  utcOffsetMinutes: number;
  source: BirthContext['timezone']['source'];
};

/**
 * Offset to validate the birth clock against, before any fallback rule applies.
 *
 * A caller-pinned offset always wins, because only the caller can settle a DST
 * fold. Otherwise the offset is read from Korea's own zone history instead of
 * being assumed: Korea ran UTC+08:30/+09:30 from 1954 to 1961 and UTC+10:00
 * during the 1987 and 1988 summer-time periods, and substituting a present-day
 * +09:00 for those births makes the clock check reject a perfectly valid birth
 * with an error no customer can act on.
 *
 * Overseas zones are deliberately excluded. A foreign birthplace reaches us as a
 * free-text city whose IANA mapping is not verified, so the caller must state the
 * offset rather than have one inferred from a zone we are not sure of.
 */
function resolveCandidateUtcOffsetMinutes(
  options: BirthContextOptions,
  timezoneId: string,
  date: BirthContext['date'],
  time: BirthContext['time']
): ResolvedUtcOffset | null {
  if (options.utcOffsetMinutes !== undefined) {
    return { utcOffsetMinutes: options.utcOffsetMinutes, source: 'explicit' };
  }

  if (timezoneId !== KOREA_TIMEZONE) {
    return null;
  }

  // Noon never falls inside a DST transition, so an unknown birth time still
  // resolves the correct calendar-day offset.
  const historical = resolveHistoricalUtcOffsetMinutes(
    { ...date, hour: time.hour ?? 12, minute: time.minute ?? 0 },
    timezoneId
  );

  return historical === null
    ? null
    : { utcOffsetMinutes: historical, source: 'tzdata-historical' };
}

/** Applies the fail-closed fallbacks once the clock itself has been validated. */
function resolveUtcOffsetMinutes(
  candidate: ResolvedUtcOffset | null,
  timezoneId: string,
  birthYear: number
): ResolvedUtcOffset {
  if (candidate) {
    return candidate;
  }

  if (timezoneId === KOREA_TIMEZONE) {
    if (birthYear < 1962) {
      throw new Error(
        '1962년 이전 한국 출생은 역사적 표준시·서머타임 확인을 위해 출생 당시 UTC 오프셋을 반드시 입력해야 합니다.'
      );
    }
    return { utcOffsetMinutes: KST_OFFSET_MINUTES, source: 'korea-default' };
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
  const date = parseCivilDate(formData.birthDate, calendar);
  const time = parseBirthTime(formData.birthTime, Boolean(formData.isUnknownTime));
  const location = buildLocation(formData, options);
  const timezoneId = options.timezoneId || KOREA_TIMEZONE;
  assertValidIanaTimeZone(timezoneId);

  // The candidate is computed first so the clock check compares against the
  // offset really in force at birth, but the fail-closed fallbacks run after it
  // so a DST gap or fold is still reported as such rather than as a missing offset.
  const candidate = resolveCandidateUtcOffsetMinutes(options, timezoneId, date, time);

  // A lunar input first needs canonical solar conversion. That path is checked
  // in calculateBirthContext before any true-solar or pillar calculation.
  if (
    calendar === 'solar'
    && time.precision === 'exact-minute'
    && time.hour !== null
    && time.minute !== null
  ) {
    assertResolvableLocalDateTime(
      { ...date, hour: time.hour, minute: time.minute },
      timezoneId,
      candidate?.utcOffsetMinutes
    );
  }

  const { utcOffsetMinutes, source } = resolveUtcOffsetMinutes(candidate, timezoneId, date.year);
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
    time,
    location,
    timezone: {
      id: timezoneId,
      utcOffsetMinutes,
      source
    },
    trueSolarTime: {
      enabled: applyTrueSolarTime,
      includeEquationOfTime: options.includeEquationOfTime ?? true
    },
    dayBoundaryPolicy: options.dayBoundaryPolicy || 'civil-midnight'
  };
}
