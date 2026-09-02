import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IntakeFormData } from '../src/api/mockData';
import { buildDeterministicSajuBasis } from '../src/lib/saju/deterministicBasis';
import { DayUtil } from '../src/lib/saju/sxtwl';

interface SolarTermRecord {
  year: number;
  angle: number;
  name: string;
  officialNaojUtc: string | null;
  jplSkyfieldUtc: string;
  engineWrapperUtc: string;
  engineMinusJplSeconds: number;
}

interface SolarTermAudit {
  records: SolarTermRecord[];
}

const root = process.cwd();
const sourcePath = resolve(root, 'artifacts/solar-term-audit/solar-term-engine-audit.json');
const outputPath = resolve(root, 'artifacts/solar-term-audit/solar-term-boundary-impact.json');
const source = JSON.parse(readFileSync(sourcePath, 'utf8')) as SolarTermAudit;

const stems = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
const branches = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
const majorAngles = new Set([285, 315, 345, 15, 45, 75, 105, 135, 165, 195, 225, 255]);
const offsets = [-10, -7, -5, -1, 0, 1, 5, 7, 10];

function kstParts(utcMillis: number) {
  const date = new Date(utcMillis + 9 * 60 * 60_000);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes()
  };
}

function label(gz: { tg: number; dz: number }) {
  return `${stems[gz.tg]}${branches[gz.dz]}`;
}

function intakeAt(utcMillis: number): IntakeFormData {
  const local = kstParts(utcMillis);
  return {
    name: '절기 경계 감사',
    gender: 'male',
    calendar: 'solar',
    isLeapMonth: false,
    birthDate: `${local.year}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`,
    birthTime: `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`,
    isUnknownTime: false,
    birthTimePrecision: 'exact-minute',
    dayBoundaryPolicy: 'midnight',
    birthLocation: {
      label: '서울특별시',
      latitude: 37.5665,
      longitude: 126.978,
      timezone: 'Asia/Seoul',
      utcOffsetMinutes: 540,
      applySolarTimeCorrection: false
    },
    timezone: 'Asia/Seoul',
    utcOffsetMinutes: 540,
    latitude: 37.5665,
    longitude: 126.978,
    applySolarTimeCorrection: false,
    relationshipStatus: 'single',
    relationshipDuration: 'under1',
    q1: '이 명식에서 지금 가장 먼저 확인할 흐름은 무엇인가요?',
    q2: '현재 선택을 할 때 구체적으로 주의할 점은 무엇인가요?'
  };
}

function pillarsAt(utcMillis: number) {
  const local = kstParts(utcMillis);
  const day = new DayUtil(local.year, local.month, local.day, local.hour, local.minute, 'solar', 'normal', false);
  return {
    year: label(day.getYearGZ()),
    month: label(day.getMonthGZ())
  };
}

const boundaryTerms = source.records
  .filter((record) => record.year === 2024 && majorAngles.has(record.angle) && record.officialNaojUtc)
  .sort((left, right) => Date.parse(left.officialNaojUtc!) - Date.parse(right.officialNaojUtc!));

const boundaryRows = boundaryTerms.flatMap((term) => {
  const officialMillis = Date.parse(term.officialNaojUtc!);
  const expectedBefore = pillarsAt(officialMillis - 24 * 60 * 60_000);
  const expectedAfter = pillarsAt(officialMillis + 24 * 60 * 60_000);
  return offsets.map((offsetMinutes) => {
    const instant = officialMillis + offsetMinutes * 60_000;
    const expected = offsetMinutes < 0 ? expectedBefore : expectedAfter;
    const actual = pillarsAt(instant);
    const basis = buildDeterministicSajuBasis('general-signature', intakeAt(instant));
    const yearMismatch = term.angle === 315 && actual.year !== expected.year;
    const monthMismatch = actual.month !== expected.month;
    return {
      term: term.name,
      angle: term.angle,
      officialUtc: term.officialNaojUtc,
      engineUtc: term.engineWrapperUtc,
      engineMinusJplSeconds: term.engineMinusJplSeconds,
      offsetMinutes,
      expected,
      actual,
      yearMismatch,
      monthMismatch,
      releaseDecision: basis.commercialV2.releaseAudit.decision,
      releaseFingerprint: basis.commercialV2.releaseAudit.reproducibilityFingerprint,
      fingerprintWouldChangeWithCorrectPillars: yearMismatch || monthMismatch
    };
  });
});

const dayunSeeds = [
  ['1990-01-01', '12:30'],
  ['1992-09-09', '10:24'],
  ['2000-02-29', '23:30'],
  ['2012-06-21', '06:45'],
  ['2024-02-04', '17:28']
] as const;

const allJplMajorTerms = source.records
  .filter((record) => majorAngles.has(record.angle))
  .map((record) => ({ ...record, instant: Date.parse(record.jplSkyfieldUtc) }))
  .sort((left, right) => left.instant - right.instant);

const dayunRows = dayunSeeds.flatMap(([birthDate, birthTime]) =>
  (['male', 'female'] as const).map((gender) => {
    const [year, month, day] = birthDate.split('-').map(Number);
    const [hour, minute] = birthTime.split(':').map(Number);
    const birthUtc = Date.UTC(year, month - 1, day, hour, minute) - 9 * 60 * 60_000;
    const current = new DayUtil(year, month, day, hour, minute, 'solar', 'normal', false)
      .getDaeyunInfo(gender);
    const independentTerm = current.forward
      ? allJplMajorTerms.find((term) => term.instant > birthUtc)
      : [...allJplMajorTerms].reverse().find((term) => term.instant <= birthUtc);
    if (!independentTerm) throw new Error(`Independent Dayun boundary missing for ${birthDate} ${gender}`);
    const distanceMillis = current.forward
      ? independentTerm.instant - birthUtc
      : birthUtc - independentTerm.instant;
    const expectedStartAge = distanceMillis / 86_400_000 / 3;
    const expectedStartInstant = birthUtc + expectedStartAge * 365.2422 * 86_400_000;
    return {
      birthDate,
      birthTime,
      gender,
      forward: current.forward,
      independentBoundaryTerm: independentTerm.name,
      independentBoundaryUtc: independentTerm.jplSkyfieldUtc,
      currentStartAge: current.start_age,
      independentStartAgeUnderCurrentPolicy: expectedStartAge,
      currentStartsAt: current.start_instant.toISOString(),
      independentStartsAtUnderCurrentPolicy: new Date(expectedStartInstant).toISOString(),
      startsAtDeltaSeconds: (current.start_instant.getTime() - expectedStartInstant) / 1000,
      policyQualification: '3일=1년 및 365.2422일/년이라는 현행 정책을 고정한 경계시각 영향 추정'
    };
  })
);

const result = {
  generatedAt: new Date().toISOString(),
  source: 'NAOJ minute-rounded boundary for UI inputs; JPL DE440s/Skyfield for Dayun impact',
  offsetsMinutes: offsets,
  boundarySummary: {
    terms: boundaryTerms.length,
    cases: boundaryRows.length,
    yearMismatches: boundaryRows.filter((row) => row.yearMismatch).length,
    monthMismatches: boundaryRows.filter((row) => row.monthMismatch).length,
    fingerprintsAffected: boundaryRows.filter((row) => row.fingerprintWouldChangeWithCorrectPillars).length,
    releaseDecisions: [...new Set(boundaryRows.map((row) => row.releaseDecision))]
  },
  boundaryRows,
  dayunSummary: {
    fixtures: dayunRows.length,
    maxAbsoluteStartsAtDeltaSeconds: Math.max(...dayunRows.map((row) => Math.abs(row.startsAtDeltaSeconds))),
    meanAbsoluteStartsAtDeltaSeconds: dayunRows.reduce((sum, row) => sum + Math.abs(row.startsAtDeltaSeconds), 0) / dayunRows.length
  },
  dayunRows
};

writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ boundarySummary: result.boundarySummary, dayunSummary: result.dayunSummary }, null, 2));
