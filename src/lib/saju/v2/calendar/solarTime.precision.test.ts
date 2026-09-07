import { describe, expect, it } from 'vitest';
import evidence from '../../golden/evidence/true-solar-time-jpl-de440s.json';
import { applyTrueSolarTime, calculateEquationOfTimeMinutes } from './solarTime';
import type { CivilDateTime } from './types';

function utcCivil(instant: string): CivilDateTime {
  const date = new Date(instant);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes()
  };
}

describe('precise equation of time', () => {
  it('matches the independent JPL DE440s samples within one second', () => {
    const deltas = evidence.samples.map((sample) => Math.abs(
      calculateEquationOfTimeMinutes(utcCivil(sample.instant))
        - sample.equationOfTimeMinutes
    ) * 60);

    expect(deltas).toHaveLength(20);
    expect(Math.max(...deltas)).toBeLessThan(1);
  });

  it('uses the physical UTC instant rather than reinterpreting local clock fields', () => {
    const local = calculateEquationOfTimeMinutes({
      year: 1992,
      month: 9,
      day: 9,
      hour: 10,
      minute: 24
    }, 540);
    const utc = calculateEquationOfTimeMinutes({
      year: 1992,
      month: 9,
      day: 9,
      hour: 1,
      minute: 24
    });

    expect(local).toBeCloseTo(utc, 10);
    expect(Math.abs(local - 2.6468603596662987) * 60).toBeLessThan(1);
  });

  it('keeps the representative Seoul hour pillar side of the boundary stable', () => {
    const trace = applyTrueSolarTime({
      year: 1992,
      month: 9,
      day: 9,
      hour: 10,
      minute: 24
    }, {
      timezone: { id: 'Asia/Seoul', utcOffsetMinutes: 540, source: 'explicit' },
      location: {
        label: '서울',
        longitude: 126.978,
        source: 'verified-coordinates'
      },
      trueSolarTime: { enabled: true, includeEquationOfTime: true }
    });

    expect(trace.appliedCorrectionMinutes).toBe(-29);
    expect(trace.apparentSolarDateTime).toMatchObject({ hour: 9, minute: 55 });
  });
});
