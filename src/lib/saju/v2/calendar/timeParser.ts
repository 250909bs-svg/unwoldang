import type { BirthTimeScenario, ParsedBirthTime } from './types';

const EXACT_TIME = /^(\d{1,2}):(\d{2})$/;
const RANGE_TIME = /(\d{1,2}):(\d{2})\s*(?:-|–|—|~|～)\s*(\d{1,2}):(\d{2})/;

const UNKNOWN_BRANCH_SCENARIOS = [
  { branchIndex: 0, label: '조자시(早子時, 00시대)', hour: 0 },
  { branchIndex: 1, label: '축시(丑時)', hour: 2 },
  { branchIndex: 2, label: '인시(寅時)', hour: 4 },
  { branchIndex: 3, label: '묘시(卯時)', hour: 6 },
  { branchIndex: 4, label: '진시(辰時)', hour: 8 },
  { branchIndex: 5, label: '사시(巳時)', hour: 10 },
  { branchIndex: 6, label: '오시(午時)', hour: 12 },
  { branchIndex: 7, label: '미시(未時)', hour: 14 },
  { branchIndex: 8, label: '신시(申時)', hour: 16 },
  { branchIndex: 9, label: '유시(酉時)', hour: 18 },
  { branchIndex: 10, label: '술시(戌時)', hour: 20 },
  { branchIndex: 11, label: '해시(亥時)', hour: 22 },
  { branchIndex: 0, label: '야자시(夜子時, 23시대)', hour: 23 }
] as const;

function assertClockTime(hour: number, minute: number, field: string) {
  if (!Number.isInteger(hour) || !Number.isInteger(minute)
    || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`${field}이 올바른 24시간제 시각이 아닙니다.`);
  }
}

/**
 * Parses both new exact-minute input and the strings saved by the original UI,
 * such as `사/巳 (09:30-11:29)`. A legacy range is never promoted to exact;
 * its midpoint is only a deterministic representative and the uncertainty is
 * retained in `precision`, `range`, and `warnings`.
 */
export function parseBirthTime(rawValue: string | undefined, isUnknownTime = false): ParsedBirthTime {
  const raw = rawValue?.trim() || '';
  if (isUnknownTime || !raw) {
    return {
      raw: raw || null,
      precision: 'unknown',
      hour: null,
      minute: null,
      representativeDayOffset: 0,
      representativeStrategy: 'unknown-scenarios',
      range: null,
      warnings: ['출생 시간이 없어 12지지와 자시의 날짜 경계 전·후를 포함한 13개 시나리오를 분리 계산합니다.']
    };
  }

  const exact = raw.match(EXACT_TIME);
  if (exact) {
    const hour = Number(exact[1]);
    const minute = Number(exact[2]);
    assertClockTime(hour, minute, '출생 시각');
    return {
      raw,
      precision: 'exact-minute',
      hour,
      minute,
      representativeDayOffset: 0,
      representativeStrategy: 'provided',
      range: null,
      warnings: []
    };
  }

  const range = raw.match(RANGE_TIME);
  if (range) {
    const startHour = Number(range[1]);
    const startMinute = Number(range[2]);
    const endHour = Number(range[3]);
    const endMinute = Number(range[4]);
    assertClockTime(startHour, startMinute, '출생 시간대 시작');
    assertClockTime(endHour, endMinute, '출생 시간대 종료');

    const startTotal = startHour * 60 + startMinute;
    const rawEndTotal = endHour * 60 + endMinute;
    const crossesMidnight = rawEndTotal < startTotal;
    const endTotal = rawEndTotal + (crossesMidnight ? 24 * 60 : 0);
    const midpoint = Math.round((startTotal + endTotal) / 2);
    const representativeDayOffset = midpoint >= 24 * 60 ? 1 : 0;
    const representativeMinutes = midpoint % (24 * 60);

    return {
      raw,
      precision: 'legacy-range',
      hour: Math.floor(representativeMinutes / 60),
      minute: representativeMinutes % 60,
      representativeDayOffset,
      representativeStrategy: 'range-midpoint',
      range: {
        startHour,
        startMinute,
        endHour,
        endMinute,
        crossesMidnight
      },
      warnings: [
        '기존 시간대 입력은 정확한 출생 시각이 아닙니다. 중앙 시각을 대표값으로 계산합니다.'
      ]
    };
  }

  throw new Error('출생 시각은 HH:mm 또는 기존 시간대(HH:mm-HH:mm) 형식이어야 합니다.');
}

export function branchIndexForHour(hour: number): number {
  assertClockTime(hour, 0, '시각');
  return Math.floor((hour + 1) / 2) % 12;
}

export function buildBirthTimeScenarios(time: ParsedBirthTime): BirthTimeScenario[] {
  if (time.precision === 'unknown') {
    return UNKNOWN_BRANCH_SCENARIOS.map(({ branchIndex, label, hour }) => ({
      id: `unknown-branch-${branchIndex}-${hour}`,
      label,
      branchIndex,
      hour,
      minute: 0,
      sourcePrecision: 'unknown',
      sourceDayOffset: 0
    }));
  }

  if (time.hour === null || time.minute === null) {
    throw new Error('출생 시각 파싱 결과에 대표 시각이 없습니다.');
  }

  const branchIndex = branchIndexForHour(time.hour);
  if (time.precision === 'legacy-range' && time.range) {
    const endpointScenarios: BirthTimeScenario[] = [
      {
        id: 'legacy-range-midpoint',
        label: '기존 시간대 중앙값',
        branchIndex,
        hour: time.hour,
        minute: time.minute,
        sourcePrecision: time.precision,
        sourceDayOffset: time.representativeDayOffset
      },
      {
        id: 'legacy-range-start',
        label: '기존 시간대 시작점',
        branchIndex: branchIndexForHour(time.range.startHour),
        hour: time.range.startHour,
        minute: time.range.startMinute,
        sourcePrecision: time.precision,
        sourceDayOffset: 0
      },
      {
        id: 'legacy-range-end',
        label: '기존 시간대 종료점',
        branchIndex: branchIndexForHour(time.range.endHour),
        hour: time.range.endHour,
        minute: time.range.endMinute,
        sourcePrecision: time.precision,
        sourceDayOffset: time.range.crossesMidnight ? 1 : 0
      }
    ];

    return endpointScenarios.filter((scenario, index, scenarios) =>
      scenarios.findIndex((candidate) =>
        candidate.hour === scenario.hour &&
        candidate.minute === scenario.minute &&
        candidate.sourceDayOffset === scenario.sourceDayOffset
      ) === index
    );
  }

  return [{
    id: 'exact-time',
    label: '정확 시각',
    branchIndex,
    hour: time.hour,
    minute: time.minute,
    sourcePrecision: time.precision,
    sourceDayOffset: time.representativeDayOffset
  }];
}
