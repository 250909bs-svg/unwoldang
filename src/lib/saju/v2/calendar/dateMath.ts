import type { CivilDate, CivilDateTime } from './types';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidCivilDate(date: CivilDate): boolean {
  if (!Number.isInteger(date.year) || !Number.isInteger(date.month) || !Number.isInteger(date.day)) {
    return false;
  }

  const check = new Date(Date.UTC(date.year, date.month - 1, date.day));
  return check.getUTCFullYear() === date.year
    && check.getUTCMonth() + 1 === date.month
    && check.getUTCDate() === date.day;
}

export function parseCivilDate(value: string | undefined, calendar: 'solar' | 'lunar' = 'solar'): CivilDate {
  const match = value?.trim().match(ISO_DATE);
  if (!match) {
    throw new Error('생년월일은 YYYY-MM-DD 형식이어야 합니다.');
  }

  const date = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };

  const isValidLunarShape = date.year >= 1000 && date.year <= 9999 &&
    date.month >= 1 && date.month <= 12 && date.day >= 1 && date.day <= 30;
  if (calendar === 'lunar' ? !isValidLunarShape : !isValidCivilDate(date)) {
    throw new Error('존재하지 않는 생년월일입니다.');
  }

  return date;
}

export function addMinutes(value: CivilDateTime, minutes: number): CivilDateTime {
  const timestamp = Date.UTC(
    value.year,
    value.month - 1,
    value.day,
    value.hour,
    value.minute + minutes
  );
  const result = new Date(timestamp);
  return {
    year: result.getUTCFullYear(),
    month: result.getUTCMonth() + 1,
    day: result.getUTCDate(),
    hour: result.getUTCHours(),
    minute: result.getUTCMinutes()
  };
}

export function addDays(value: CivilDate, days: number): CivilDate {
  const result = new Date(Date.UTC(value.year, value.month - 1, value.day + days));
  return {
    year: result.getUTCFullYear(),
    month: result.getUTCMonth() + 1,
    day: result.getUTCDate()
  };
}

export function datePart(value: CivilDateTime): CivilDate {
  return { year: value.year, month: value.month, day: value.day };
}

export function compareCivilDate(left: CivilDate, right: CivilDate): number {
  const leftValue = Date.UTC(left.year, left.month - 1, left.day);
  const rightValue = Date.UTC(right.year, right.month - 1, right.day);
  return Math.sign(leftValue - rightValue);
}

export function formatCivilDateTime(value: CivilDateTime): string {
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${value.year}-${pad(value.month)}-${pad(value.day)}T${pad(value.hour)}:${pad(value.minute)}`;
}
