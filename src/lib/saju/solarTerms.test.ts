import { describe, expect, it } from 'vitest';
import { getLegacySolarTermInstantForGregorianYear } from './solarTermLegacy';
import {
  getSolarTermInstantForGregorianYear,
  SOLAR_TERM_ENGINE_VERSION,
  SOLAR_TERM_LONGITUDES,
} from './solarTerms';

const NAOJ_2024 = [
  [0, '2024-03-20T03:06:00Z'],
  [15, '2024-04-04T07:02:00Z'],
  [30, '2024-04-19T14:00:00Z'],
  [45, '2024-05-05T00:10:00Z'],
  [60, '2024-05-20T13:00:00Z'],
  [75, '2024-06-05T04:10:00Z'],
  [90, '2024-06-20T20:51:00Z'],
  [105, '2024-07-06T14:20:00Z'],
  [120, '2024-07-22T07:44:00Z'],
  [135, '2024-08-07T00:09:00Z'],
  [150, '2024-08-22T14:55:00Z'],
  [165, '2024-09-07T03:11:00Z'],
  [180, '2024-09-22T12:44:00Z'],
  [195, '2024-10-07T19:00:00Z'],
  [210, '2024-10-22T22:15:00Z'],
  [225, '2024-11-06T22:20:00Z'],
  [240, '2024-11-21T19:56:00Z'],
  [255, '2024-12-06T15:17:00Z'],
  [270, '2024-12-21T09:21:00Z'],
  [285, '2024-01-05T20:49:00Z'],
  [300, '2024-01-20T14:07:00Z'],
  [315, '2024-02-04T08:27:00Z'],
  [330, '2024-02-19T04:13:00Z'],
  [345, '2024-03-05T02:23:00Z'],
] as const;

const JPL_2024 = [
  [0, '2024-03-20T03:06:24.155Z'],
  [15, '2024-04-04T07:02:17.696Z'],
  [315, '2024-02-04T08:27:07.592Z'],
  [345, '2024-03-05T02:22:46.136Z'],
] as const;

const differenceSeconds = (left: Date, rightIso: string) =>
  Math.abs(left.getTime() - Date.parse(rightIso)) / 1_000;

describe('production solar-term astronomical engine', () => {
  it('pins the audited dependency version in the calculation contract', () => {
    expect(SOLAR_TERM_ENGINE_VERSION).toBe('astronomy-engine-2.1.19');
  });

  it('defines all 24 canonical term names and longitudes exactly once', () => {
    expect(SOLAR_TERM_LONGITUDES).toHaveLength(24);
    expect(new Set(SOLAR_TERM_LONGITUDES.map(({ name }) => name)).size).toBe(24);
    expect(new Set(SOLAR_TERM_LONGITUDES.map(({ longitude }) => longitude)).size).toBe(24);
    expect(SOLAR_TERM_LONGITUDES.map(({ name }) => name)).toEqual([
      '춘분', '청명', '곡우', '입하', '소만', '망종',
      '하지', '소서', '대서', '입추', '처서', '백로',
      '추분', '한로', '상강', '입동', '소설', '대설',
      '동지', '소한', '대한', '입춘', '우수', '경칩',
    ]);
    expect(SOLAR_TERM_LONGITUDES.map(({ longitude }) => longitude)).toEqual(
      Array.from({ length: 24 }, (_, index) => index * 15),
    );
  });

  it('finds every canonical term in the requested Gregorian year across the supported range', () => {
    for (let year = 1900; year <= 2099; year += 1) {
      for (const { longitude } of SOLAR_TERM_LONGITUDES) {
        expect(getSolarTermInstantForGregorianYear(year, longitude).getUTCFullYear()).toBe(year);
      }
    }
  });

  it('matches every 2024 NAOJ minute-rounded official term within rounding tolerance', () => {
    for (const [longitude, officialUtc] of NAOJ_2024) {
      expect(
        differenceSeconds(getSolarTermInstantForGregorianYear(2024, longitude), officialUtc),
      ).toBeLessThanOrEqual(75);
    }
  });

  it('matches independent JPL DE440s spot references within the audited bound', () => {
    for (const [longitude, jplUtc] of JPL_2024) {
      expect(
        differenceSeconds(getSolarTermInstantForGregorianYear(2024, longitude), jplUtc),
      ).toBeLessThanOrEqual(45);
    }
  });

  it('returns an absolute UTC instant without applying the KST offset twice', () => {
    const lichun = getSolarTermInstantForGregorianYear(2024, 315);
    expect(lichun.toISOString()).toBe('2024-02-04T08:26:49.630Z');
    expect(lichun.getUTCHours()).toBe(8);
  });

  it('materially improves the complete 2024 official comparison over the legacy model', () => {
    const preciseError = NAOJ_2024.reduce(
      (sum, [longitude, officialUtc]) =>
        sum + differenceSeconds(getSolarTermInstantForGregorianYear(2024, longitude), officialUtc),
      0,
    );
    const legacyError = NAOJ_2024.reduce(
      (sum, [longitude, officialUtc]) =>
        sum + differenceSeconds(getLegacySolarTermInstantForGregorianYear(2024, longitude), officialUtc),
      0,
    );

    expect(preciseError).toBeLessThan(legacyError / 10);
  });

  it('fails closed for unsupported input instead of returning the legacy approximation', () => {
    expect(() => getSolarTermInstantForGregorianYear(1899, 315)).toThrow();
    expect(() => getSolarTermInstantForGregorianYear(2024, -1)).toThrow();
    expect(() => getSolarTermInstantForGregorianYear(2024, 360)).toThrow();
  });
});
