import { describe, expect, it } from 'vitest';
import {
  REUNION_AGE_BANDS,
  ageYearsAt,
  containsAgeNotation,
  parseCalendarDate,
  resolveReunionAgeBand,
  toAgeBand,
  toDayunYearRange
} from './ageBand';

describe('reunion age band', () => {
  it('reads ISO, Korean and instant date forms', () => {
    expect(parseCalendarDate('1994-03-12')).toEqual({ year: 1994, month: 3, day: 12 });
    expect(parseCalendarDate('1994년 3월 12일')).toEqual({ year: 1994, month: 3, day: 12 });
    expect(parseCalendarDate('2026-09-18T01:00:00.000Z')).toEqual({ year: 2026, month: 9, day: 18 });
    expect(parseCalendarDate('1994-02-30')).toBeNull();
    expect(parseCalendarDate('')).toBeNull();
    expect(parseCalendarDate(undefined)).toBeNull();
  });

  it('converts an instant to the KST calendar day so a midnight reference does not slip', () => {
    /* 2026-09-17T16:00Z 는 KST 로 2026-09-18 01:00 이다. */
    expect(parseCalendarDate('2026-09-17T16:00:00.000Z')).toEqual({ year: 2026, month: 9, day: 18 });
  });

  it('counts full years and subtracts one before the birthday', () => {
    expect(ageYearsAt({ year: 1994, month: 3, day: 12 }, { year: 2026, month: 3, day: 12 })).toBe(32);
    expect(ageYearsAt({ year: 1994, month: 3, day: 12 }, { year: 2026, month: 3, day: 11 })).toBe(31);
    expect(ageYearsAt({ year: 1994, month: 3, day: 12 }, { year: 2026, month: 2, day: 28 })).toBe(31);
  });

  it('maps every band boundary exactly as the spec table', () => {
    expect(toAgeBand(19)).toBe('teen');
    expect(toAgeBand(20)).toBe('early20s');
    expect(toAgeBand(24)).toBe('early20s');
    expect(toAgeBand(25)).toBe('late20s');
    expect(toAgeBand(29)).toBe('late20s');
    expect(toAgeBand(30)).toBe('thirties');
    expect(toAgeBand(39)).toBe('thirties');
    expect(toAgeBand(40)).toBe('forties');
    expect(toAgeBand(49)).toBe('forties');
    expect(toAgeBand(50)).toBe('fiftyPlus');
  });

  it('lands on neutral — not late20s — for every unusable input', () => {
    expect(toAgeBand(null)).toBe('neutral');
    expect(toAgeBand(Number.NaN)).toBe('neutral');
    expect(toAgeBand(9)).toBe('neutral');
    expect(toAgeBand(121)).toBe('neutral');
    expect(resolveReunionAgeBand({})).toEqual({ ageYears: null, ageBand: 'neutral' });
    expect(resolveReunionAgeBand({ birthDate: '1994-03-12' })).toEqual({ ageYears: null, ageBand: 'neutral' });
    expect(resolveReunionAgeBand({ referenceInstant: '2026-09-18T01:00:00.000Z' }).ageBand).toBe('neutral');
  });

  it('is pure: the same birth date and reference instant always produce the same band', () => {
    const input = { birthDate: '1994-03-12', referenceInstant: '2026-09-18T01:00:00.000Z' };
    expect(resolveReunionAgeBand(input)).toEqual({ ageYears: 32, ageBand: 'thirties' });
    expect(resolveReunionAgeBand(input)).toEqual(resolveReunionAgeBand(input));
  });

  it('declares every band exactly once', () => {
    expect(new Set(REUNION_AGE_BANDS).size).toBe(REUNION_AGE_BANDS.length);
    expect(REUNION_AGE_BANDS).toContain('neutral');
  });
});

describe('dayun age leak', () => {
  it('reads the year range off the calculated dayun boundaries', () => {
    /* `baziCalcs.ts` 가 실제로 내는 값의 모양. 1992-09-09 생, `30세 ~ 39세` 행의 경계다.
       생년 + 시작 나이로 되짚으면 2022~2031 이 나오지만 실제 구간은 2023~2033 이다 —
       입운이 정수 나이가 아니라 절기 기준 시각(30.56세)에서 시작하기 때문이다. */
    expect(toDayunYearRange('2023-03-31T00:00:00.000Z', '2033-03-31T00:00:00.000Z')).toBe('2023 ~ 2033');
  });

  it('returns null rather than inventing a year from an age string', () => {
    expect(toDayunYearRange('30세 ~ 39세', '39세')).toBeNull();
    expect(toDayunYearRange(null, '2033-03-31T00:00:00.000Z')).toBeNull();
    expect(toDayunYearRange('2023-03-31T00:00:00.000Z', undefined)).toBeNull();
    expect(toDayunYearRange('2033-03-31T00:00:00.000Z', '2023-03-31T00:00:00.000Z')).toBeNull();
  });

  it('detects a leftover age notation', () => {
    expect(containsAgeNotation('乙巳 · 30세 ~ 39세')).toBe(true);
    expect(containsAgeNotation('乙巳 · 2024 ~ 2033')).toBe(false);
  });
});
