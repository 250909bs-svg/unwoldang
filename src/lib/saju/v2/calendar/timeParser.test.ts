import { describe, expect, it } from 'vitest';
import { buildBirthTimeScenarios, parseBirthTime } from './timeParser';

describe('parseBirthTime', () => {
  it('preserves exact minute input as exact', () => {
    expect(parseBirthTime('09:36')).toMatchObject({
      precision: 'exact-minute',
      hour: 9,
      minute: 36,
      representativeStrategy: 'provided',
      range: null,
      warnings: []
    });
  });

  it('marks a v1 time label as a legacy range and uses only its midpoint as representative', () => {
    expect(parseBirthTime('사/巳 (09:30-11:29)')).toMatchObject({
      precision: 'legacy-range',
      hour: 10,
      minute: 30,
      representativeStrategy: 'range-midpoint',
      range: {
        startHour: 9,
        startMinute: 30,
        endHour: 11,
        endMinute: 29,
        crossesMidnight: false
      }
    });
  });

  it('retains the date offset for a range crossing midnight', () => {
    expect(parseBirthTime('23:00-01:00')).toMatchObject({
      precision: 'legacy-range',
      hour: 0,
      minute: 0,
      representativeDayOffset: 1,
      range: { crossesMidnight: true }
    });
  });

  it('lets the explicit unknown flag override stale saved clock text', () => {
    expect(parseBirthTime('10:10', true)).toMatchObject({
      precision: 'unknown',
      hour: null,
      minute: null
    });
  });

  it('rejects invalid or ambiguous free-form clock text', () => {
    expect(() => parseBirthTime('24:00')).toThrow(/24시간제/);
    expect(() => parseBirthTime('오전 열 시')).toThrow(/HH:mm/);
  });
});

describe('buildBirthTimeScenarios', () => {
  it('generates every earthly branch plus both civil-day sides of zi hour', () => {
    const scenarios = buildBirthTimeScenarios(parseBirthTime('', true));
    expect(scenarios).toHaveLength(13);
    expect(scenarios.map((scenario) => scenario.branchIndex)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0
    ]);
    expect(new Set(scenarios.map((scenario) => scenario.id)).size).toBe(13);
  });

  it('checks the start, midpoint, and end of a legacy time range', () => {
    const scenarios = buildBirthTimeScenarios(parseBirthTime('사/巳 (09:30-11:29)'));
    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      'legacy-range-midpoint',
      'legacy-range-start',
      'legacy-range-end'
    ]);
  });
});
