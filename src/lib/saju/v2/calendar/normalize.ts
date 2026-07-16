import type { IntakeFormData } from '../../../../api/mockData';
import { parseCivilDate } from './dateMath';
import { parseBirthTime } from './timeParser';
import type { BirthContext, BirthContextOptions, BirthLocation } from './types';

const KOREA_TIMEZONE = 'Asia/Seoul';
const KST_OFFSET_MINUTES = 9 * 60;

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
  const location = buildLocation(formData, options);
  const hasExplicitTimezone = options.timezoneId !== undefined || options.utcOffsetMinutes !== undefined;
  const utcOffsetMinutes = options.utcOffsetMinutes ?? KST_OFFSET_MINUTES;
  if (!Number.isFinite(utcOffsetMinutes) || utcOffsetMinutes < -14 * 60 || utcOffsetMinutes > 14 * 60) {
    throw new Error('UTC 오프셋은 -14:00부터 +14:00 사이여야 합니다.');
  }

  const applyTrueSolarTime = options.applyTrueSolarTime ?? location?.longitude !== undefined;

  return {
    name: formData.name?.trim() || '',
    gender: formData.gender === 'male' ? 'male' : 'female',
    calendar: formData.calendar === 'lunar' ? 'lunar' : 'solar',
    isLeapMonth: Boolean(formData.isLeapMonth),
    date: parseCivilDate(formData.birthDate, formData.calendar === 'lunar' ? 'lunar' : 'solar'),
    time: parseBirthTime(formData.birthTime, Boolean(formData.isUnknownTime)),
    location,
    timezone: {
      id: options.timezoneId || KOREA_TIMEZONE,
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
