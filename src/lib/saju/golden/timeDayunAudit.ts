import timeDayunEvidence from './evidence/time-dayun-6tail-1.7.7.json';
import { generalSignatureGoldenFixtures } from './fixtures';
import { runCurrentDeterministicFacts } from './harness';
import {
  auditBranches,
  auditStems,
  independentDayunDirection,
  independentHourBranchByClockHour,
  independentHourStemTable,
  koreanGanzhi
} from './independentTimeDayunTables';
import type { GoldenFixture } from './schema';
import { DayUtil } from '../sxtwl';
import { branchIndexForHour } from '../v2/calendar/timeParser';
import { normalizeIntakeFormToBirthContext } from '../v2/calendar/normalize';

type LateZiPolicy = 'civil-midnight' | 'late-zi-next-day';

function dayBoundaryFixture(date: string, time: string, policy: LateZiPolicy): GoldenFixture {
  const source = generalSignatureGoldenFixtures.find((fixture) =>
    fixture.category === 'day-boundary'
    && fixture.input.birthDate === date
    && fixture.input.lateZiPolicy === policy
  );
  if (!source) throw new Error(`Missing day-boundary base fixture for ${date}/${policy}.`);
  return {
    ...source,
    id: `audit-${date}-${time}-${policy}`,
    input: { ...source.input, birthTime: time }
  };
}

function currentDayunFixture(fixtureId: string) {
  const fixture = generalSignatureGoldenFixtures.find((candidate) => candidate.id === fixtureId);
  if (!fixture) throw new Error(`Missing dayun fixture ${fixtureId}.`);
  return { fixture, actual: runCurrentDeterministicFacts(fixture) };
}

function localRoundTripMatches(
  date: string,
  time: string,
  timezone: string,
  utcOffsetMinutes: number
) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const instant = new Date(Date.UTC(year, month - 1, day, hour, minute) - utcOffsetMinutes * 60_000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).formatToParts(instant);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}` === `${date}T${time}`;
}

export function evaluateTimeAndDayunAudit() {
  const hourBranchRows = independentHourBranchByClockHour.map((expected, hour) => ({
    hour,
    expected,
    actual: auditBranches[branchIndexForHour(hour)],
    match: auditBranches[branchIndexForHour(hour)] === expected
  }));

  const hourStemRows = auditStems.flatMap((dayStem, dayStemIndex) =>
    auditBranches.map((hourBranch, hourBranchIndex) => {
      const representativeHour = hourBranchIndex === 0 ? 0 : hourBranchIndex * 2 - 1;
      const actualIndex = new DayUtil(
        2024, 1, 1, representativeHour, 0, 'solar', 'normal', false
      ).getHourGZ(dayStemIndex).tg;
      const expected = independentHourStemTable[dayStemIndex][hourBranchIndex];
      return {
        dayStem,
        hourBranch,
        expected,
        actual: auditStems[actualIndex],
        match: auditStems[actualIndex] === expected
      };
    })
  );

  const lateZiRows = timeDayunEvidence.lateZi.map((evidence) => {
    const fixture = dayBoundaryFixture(
      evidence.date,
      evidence.time,
      evidence.policy as LateZiPolicy
    );
    const actual = runCurrentDeterministicFacts(fixture);
    const expectedDay = koreanGanzhi(evidence.dayPillar);
    const expectedHour = koreanGanzhi(evidence.hourPillar);
    const dayMatch = actual.dayPillar === expectedDay;
    const hourMatch = actual.hourPillar === expectedHour;
    return {
      date: evidence.date,
      time: evidence.time,
      policy: evidence.policy,
      expectedDay,
      actualDay: actual.dayPillar,
      expectedHour,
      actualHour: actual.hourPillar,
      dayMatch,
      hourMatch,
      classification: !hourMatch && evidence.policy === 'civil-midnight' && evidence.time.startsWith('23:')
        ? 'POLICY_DIFFERENCE'
        : dayMatch && hourMatch
          ? 'MATCH'
          : 'UNEXPLAINED_MISMATCH'
    };
  });

  const dayunRows = timeDayunEvidence.dayun.map((evidence) => {
    const { fixture, actual } = currentDayunFixture(evidence.fixtureId);
    const tableDirection = independentDayunDirection(
      actual.yearPillar?.slice(0, 1) || '',
      fixture.input.gender
    );
    const startsAtDeltaSeconds = actual.dayunStartsAt
      ? (Date.parse(actual.dayunStartsAt) - Date.parse(evidence.startsAtInstant)) / 1000
      : null;
    return {
      fixtureId: evidence.fixtureId,
      gender: evidence.gender,
      yearPillar: actual.yearPillar,
      providerDirection: evidence.direction,
      tableDirection,
      currentDirection: actual.dayunDirection,
      directionMatch: actual.dayunDirection === evidence.direction && actual.dayunDirection === tableDirection,
      providerFirstDayun: koreanGanzhi(evidence.firstDayun),
      currentFirstDayun: actual.firstDayun,
      firstDayunMatch: actual.firstDayun === koreanGanzhi(evidence.firstDayun),
      providerStartsAt: evidence.startsAtInstant,
      currentStartsAt: actual.dayunStartsAt,
      startsAtDeltaSeconds,
      startsAtClassification: startsAtDeltaSeconds === 0 ? 'MATCH' : 'POLICY_DIFFERENCE'
    };
  });

  const nonexistentNewYorkInputAccepted = (() => {
    try {
      normalizeIntakeFormToBirthContext({
        gender: 'male', calendar: 'solar', birthDate: '2024-03-10', birthTime: '02:30'
      }, {
        timezoneId: 'America/New_York', utcOffsetMinutes: -300
      });
      return true;
    } catch {
      return false;
    }
  })();

  const springGapRoundTripValid = localRoundTripMatches(
    '2024-03-10', '02:30', 'America/New_York', -300
  );
  const fallBackFirst = localRoundTripMatches('2024-11-03', '01:30', 'America/New_York', -240);
  const fallBackSecond = localRoundTripMatches('2024-11-03', '01:30', 'America/New_York', -300);

  const startsAtDeltas = dayunRows
    .map((row) => row.startsAtDeltaSeconds)
    .filter((value): value is number => value !== null);

  const representativeFixture = generalSignatureGoldenFixtures.find((fixture) => fixture.id === 'solar-general-001');
  if (!representativeFixture) throw new Error('Missing representative 1992 fixture.');
  const representativeActual = runCurrentDeterministicFacts(representativeFixture);
  const representativeExpectedHour = `${independentHourStemTable[4][5]}사`;

  return {
    source: {
      id: timeDayunEvidence.sourceId,
      version: timeDayunEvidence.version,
      integrity: timeDayunEvidence.integrity,
      license: timeDayunEvidence.license,
      limitations: timeDayunEvidence.limitations
    },
    hourBranch: {
      total: hourBranchRows.length,
      matches: hourBranchRows.filter((row) => row.match).length,
      rows: hourBranchRows
    },
    hourStem: {
      total: hourStemRows.length,
      matches: hourStemRows.filter((row) => row.match).length,
      rows: hourStemRows
    },
    representative1992: {
      dayPillar: representativeActual.dayPillar,
      dayStemSource: 'KASI lunIljin: 무자',
      localTime: '10:24',
      hourBranch: '사',
      expectedHourPillar: representativeExpectedHour,
      actualHourPillar: representativeActual.hourPillar,
      match: representativeActual.hourPillar === representativeExpectedHour
    },
    lateZi: {
      total: lateZiRows.length,
      dayMatches: lateZiRows.filter((row) => row.dayMatch).length,
      hourMatches: lateZiRows.filter((row) => row.hourMatch).length,
      policyDifferences: lateZiRows.filter((row) => row.classification === 'POLICY_DIFFERENCE').length,
      unexplainedMismatches: lateZiRows.filter((row) => row.classification === 'UNEXPLAINED_MISMATCH').length,
      rows: lateZiRows
    },
    dayun: {
      total: dayunRows.length,
      directionMatches: dayunRows.filter((row) => row.directionMatch).length,
      firstDayunMatches: dayunRows.filter((row) => row.firstDayunMatch).length,
      startsAtMatches: dayunRows.filter((row) => row.startsAtClassification === 'MATCH').length,
      startsAtPolicyDifferences: dayunRows.filter((row) => row.startsAtClassification === 'POLICY_DIFFERENCE').length,
      startsAtMaxAbsDeltaSeconds: Math.max(...startsAtDeltas.map(Math.abs)),
      rows: dayunRows
    },
    timezoneDst: {
      springGapRoundTripValid,
      nonexistentNewYorkInputAccepted,
      fallBackExplicitOffsetsBothValid: fallBackFirst && fallBackSecond,
      classification: !springGapRoundTripValid && nonexistentNewYorkInputAccepted
        ? 'ENGINE_BUG_CONFIRMED'
        : 'MATCH'
    }
  };
}
