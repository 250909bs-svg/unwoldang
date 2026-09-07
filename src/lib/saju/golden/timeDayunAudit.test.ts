import { describe, expect, it } from 'vitest';
import { evaluateTimeAndDayunAudit } from './timeDayunAudit';

describe('independent late-Zi, hour-pillar, and dayun audit', () => {
  const audit = evaluateTimeAndDayunAudit();

  it('matches all 24 civil hours to the independent twelve-branch table', () => {
    expect(audit.hourBranch).toMatchObject({ total: 24, matches: 24 });
  });

  it('matches the independent Five-Rat 10 day-stem by 12 hour-branch table', () => {
    expect(audit.hourStem).toMatchObject({ total: 120, matches: 120 });
  });

  it('separates day-boundary agreement from the documented late-Zi hour policy', () => {
    expect(audit.lateZi).toMatchObject({
      total: 32,
      dayMatches: 32,
      hourMatches: 26,
      policyDifferences: 6,
      unexplainedMismatches: 0
    });
  });

  it('independently confirms the representative 1992 hour pillar', () => {
    expect(audit.representative1992).toEqual({
      dayPillar: '무자',
      dayStemSource: 'KASI lunIljin: 무자',
      localTime: '10:24',
      hourBranch: '사',
      expectedHourPillar: '정사',
      actualHourPillar: '정사',
      match: true
    });
  });

  it('matches direction and first-dayun for all five male/female pairs', () => {
    expect(audit.dayun).toMatchObject({
      total: 10,
      directionMatches: 10,
      firstDayunMatches: 10,
      startsAtMatches: 0,
      startsAtPolicyDifferences: 10
    });
    expect(audit.dayun.startsAtMaxAbsDeltaSeconds).toBeCloseTo(190_615.538, 3);
  });

  it('confirms the nonexistent DST local time is rejected after IANA validation', () => {
    expect(audit.timezoneDst).toEqual({
      springGapRoundTripValid: false,
      nonexistentNewYorkInputAccepted: false,
      fallBackExplicitOffsetsBothValid: true,
      classification: 'MATCH'
    });
  });
});
