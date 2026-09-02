import { readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { DayUtil } from '../src/lib/saju/sxtwl';
import { getLegacySolarTermInstantForGregorianYear } from '../src/lib/saju/solarTermLegacy';
import {
  getSolarTermInstantForGregorianYear,
  SOLAR_TERM_ENGINE_VERSION,
  SOLAR_TERM_LONGITUDES,
} from '../src/lib/saju/solarTerms';

interface ReferenceRecord {
  year: number;
  angle: number;
  name: string;
  officialNaojUtc: string | null;
  jplSkyfieldUtc: string;
}

interface ReferenceAudit {
  records: ReferenceRecord[];
}

type TermResolver = (year: number, longitude: number) => Date;

const root = process.cwd();
const referencePath = resolve(root, 'artifacts/solar-term-audit/solar-term-engine-audit.json');
const outputPath = resolve(root, 'artifacts/solar-term-audit/solar-term-engine-fix-validation.json');
const reference = JSON.parse(readFileSync(referencePath, 'utf8')) as ReferenceAudit;
const majorLongitudes = new Set([285, 315, 345, 15, 45, 75, 105, 135, 165, 195, 225, 255]);
const boundaryOffsetsMinutes = [-10, -7, -5, -1, 0, 1, 5, 7, 10];
const exactOffsetsSeconds = [-600, -420, -300, -60, -30, 0, 30, 60, 300, 420, 600];
const stems = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
const branches = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];

const secondsBetween = (left: Date | string, right: Date | string) => {
  const leftMillis = left instanceof Date ? left.getTime() : Date.parse(left);
  const rightMillis = right instanceof Date ? right.getTime() : Date.parse(right);
  return (leftMillis - rightMillis) / 1_000;
};

const percentile = (values: number[], fraction: number) => {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1);
  return sorted[index];
};

const statistics = (deltas: number[]) => {
  const absolute = deltas.map(Math.abs);
  return {
    count: deltas.length,
    maximumAbsoluteSeconds: Math.max(...absolute),
    meanAbsoluteSeconds: absolute.reduce((sum, value) => sum + value, 0) / absolute.length,
    p50AbsoluteSeconds: percentile(absolute, 0.5),
    p95AbsoluteSeconds: percentile(absolute, 0.95),
    p99AbsoluteSeconds: percentile(absolute, 0.99),
    signedBiasSeconds: deltas.reduce((sum, value) => sum + value, 0) / deltas.length,
  };
};

const label = (gz: { tg: number; dz: number }) => `${stems[gz.tg]}${branches[gz.dz]}`;

const kstParts = (utcMillis: number) => {
  const local = new Date(utcMillis + 9 * 60 * 60_000);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
  };
};

const pillarsAt = (utcMillis: number) => {
  const local = kstParts(utcMillis);
  const day = new DayUtil(
    local.year,
    local.month,
    local.day,
    local.hour,
    local.minute,
    'solar',
    'normal',
    false,
  );
  return { year: label(day.getYearGZ()), month: label(day.getMonthGZ()) };
};

const jplRows = reference.records.map((record) => {
  const production = getSolarTermInstantForGregorianYear(record.year, record.angle);
  return {
    year: record.year,
    term: record.name,
    targetLongitude: record.angle,
    productionUtc: production.toISOString(),
    jplUtc: record.jplSkyfieldUtc,
    deltaSeconds: secondsBetween(production, record.jplSkyfieldUtc),
  };
});

const naojRows = reference.records
  .filter((record) => record.officialNaojUtc)
  .map((record) => {
    const production = getSolarTermInstantForGregorianYear(record.year, record.angle);
    const deltaSeconds = secondsBetween(production, record.officialNaojUtc!);
    return {
      year: record.year,
      term: record.name,
      targetLongitude: record.angle,
      productionUtc: production.toISOString(),
      naojMinuteUtc: record.officialNaojUtc,
      deltaSeconds,
      withinMinuteSourceTolerance: Math.abs(deltaSeconds) <= 75,
      roundedMinuteMatch:
        Math.round(production.getTime() / 60_000) === Math.round(Date.parse(record.officialNaojUtc!) / 60_000),
    };
  });

const terms2024 = jplRows
  .filter((row) => row.year === 2024)
  .map((row) => ({
    ...row,
    naojMinuteUtc: naojRows.find(
      (candidate) => candidate.year === row.year && candidate.targetLongitude === row.targetLongitude,
    )?.naojMinuteUtc ?? null,
  }));

const boundaryTerms = reference.records
  .filter((record) => record.year === 2024 && majorLongitudes.has(record.angle) && record.officialNaojUtc)
  .sort((left, right) => Date.parse(left.officialNaojUtc!) - Date.parse(right.officialNaojUtc!));

const boundaryRows = boundaryTerms.flatMap((term) => {
  const officialMillis = Date.parse(term.officialNaojUtc!);
  const expectedBefore = pillarsAt(officialMillis - 24 * 60 * 60_000);
  const expectedAfter = pillarsAt(officialMillis + 24 * 60 * 60_000);
  return boundaryOffsetsMinutes.map((offsetMinutes) => {
    const instant = officialMillis + offsetMinutes * 60_000;
    const expected = offsetMinutes < 0 ? expectedBefore : expectedAfter;
    const actual = pillarsAt(instant);
    const exactMinuteIsAmbiguous = offsetMinutes === 0;
    return {
      term: term.name,
      targetLongitude: term.angle,
      officialMinuteUtc: term.officialNaojUtc,
      productionUtc: getSolarTermInstantForGregorianYear(2024, term.angle).toISOString(),
      offsetMinutes,
      expected,
      actual,
      exactMinuteIsAmbiguous,
      yearMismatch: !exactMinuteIsAmbiguous && term.angle === 315 && actual.year !== expected.year,
      monthMismatch: !exactMinuteIsAmbiguous && actual.month !== expected.month,
    };
  });
});

const exactBoundaryRows = boundaryTerms.flatMap((term) => {
  const jplMillis = Date.parse(term.jplSkyfieldUtc);
  const productionMillis = getSolarTermInstantForGregorianYear(2024, term.angle).getTime();
  return exactOffsetsSeconds.map((offsetSeconds) => ({
    term: term.name,
    targetLongitude: term.angle,
    offsetSeconds,
    jplUtc: term.jplSkyfieldUtc,
    productionUtc: new Date(productionMillis).toISOString(),
    expectedSide: offsetSeconds < 0 ? 'before' : 'at-or-after',
    productionSide: jplMillis + offsetSeconds * 1_000 < productionMillis ? 'before' : 'at-or-after',
  }));
});

const dayunSeeds = [
  ['1990-01-01', '12:30'],
  ['1992-09-09', '10:24'],
  ['2000-02-29', '23:30'],
  ['2012-06-21', '06:45'],
  ['2024-02-04', '17:28'],
] as const;

const nearestMajorTerm = (
  birthUtc: number,
  birthYear: number,
  forward: boolean,
  resolver: TermResolver,
) => {
  const terms = [birthYear - 1, birthYear, birthYear + 1].flatMap((year) =>
    [...majorLongitudes].map((longitude) => ({
      longitude,
      instant: resolver(year, longitude).getTime(),
    })),
  ).sort((left, right) => left.instant - right.instant);

  const selected = forward
    ? terms.find((term) => term.instant > birthUtc)
    : [...terms].reverse().find((term) => term.instant <= birthUtc);
  if (!selected) throw new Error(`대운 절기 경계를 찾지 못했습니다: ${birthYear}`);
  return selected;
};

const startsAtWithResolver = (
  birthUtc: number,
  birthYear: number,
  forward: boolean,
  resolver: TermResolver,
) => {
  const boundary = nearestMajorTerm(birthUtc, birthYear, forward, resolver);
  const distanceMillis = Math.abs(boundary.instant - birthUtc);
  const startAge = distanceMillis / 86_400_000 / 3;
  const startsAt = birthUtc + startAge * 365.2422 * 86_400_000;
  return { boundary, startAge, startsAt };
};

const dayunRows = dayunSeeds.flatMap(([birthDate, birthTime]) =>
  (['male', 'female'] as const).map((gender) => {
    const [year, month, day] = birthDate.split('-').map(Number);
    const [hour, minute] = birthTime.split(':').map(Number);
    const birthUtc = Date.UTC(year, month - 1, day, hour, minute) - 9 * 60 * 60_000;
    const production = new DayUtil(year, month, day, hour, minute, 'solar', 'normal', false)
      .getDaeyunInfo(gender);
    const legacy = startsAtWithResolver(
      birthUtc,
      year,
      production.forward,
      getLegacySolarTermInstantForGregorianYear,
    );
    const precise = startsAtWithResolver(
      birthUtc,
      year,
      production.forward,
      getSolarTermInstantForGregorianYear,
    );

    return {
      birthDate,
      birthTime,
      gender,
      forward: production.forward,
      oldSolarTermUtc: new Date(legacy.boundary.instant).toISOString(),
      newSolarTermUtc: new Date(precise.boundary.instant).toISOString(),
      oldStartsAt: new Date(legacy.startsAt).toISOString(),
      newStartsAt: new Date(precise.startsAt).toISOString(),
      productionStartsAt: production.start_instant.toISOString(),
      deltaSeconds: (precise.startsAt - legacy.startsAt) / 1_000,
      productionMatchesPrecisePolicy: Math.abs(production.start_instant.getTime() - precise.startsAt) < 2,
    };
  }),
);

const runCompleteYear = (resolver: TermResolver, year: number) => {
  for (const { longitude } of SOLAR_TERM_LONGITUDES) resolver(year, longitude);
};

const benchmark = (resolver: TermResolver, iterations: number) => {
  const started = performance.now();
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    runCompleteYear(resolver, 2024);
  }
  return performance.now() - started;
};

const coldLegacyMs = benchmark(getLegacySolarTermInstantForGregorianYear, 1);
const coldPreciseMs = benchmark(getSolarTermInstantForGregorianYear, 1);
const warmLegacyMs = benchmark(getLegacySolarTermInstantForGregorianYear, 100);
const warmPreciseMs = benchmark(getSolarTermInstantForGregorianYear, 100);

const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  productionEngine: SOLAR_TERM_ENGINE_VERSION,
  currentEngineUsedAsExpected: false,
  canonicalLongitudes: SOLAR_TERM_LONGITUDES,
  jpl240: {
    statistics: statistics(jplRows.map((row) => row.deltaSeconds)),
    rows: jplRows,
  },
  naoj120: {
    statistics: statistics(naojRows.map((row) => row.deltaSeconds)),
    roundedMinuteMatches: naojRows.filter((row) => row.roundedMinuteMatch).length,
    withinMinuteSourceTolerance: naojRows.filter((row) => row.withinMinuteSourceTolerance).length,
    rows: naojRows,
  },
  terms2024,
  boundary108: {
    before: { yearMismatches: 2, monthMismatches: 15, fingerprintsAffected: 15 },
    after: {
      cases: boundaryRows.length,
      decisiveCases: boundaryRows.filter((row) => !row.exactMinuteIsAmbiguous).length,
      minuteRoundedExactAmbiguous: boundaryRows.filter((row) => row.exactMinuteIsAmbiguous).length,
      yearMismatches: boundaryRows.filter((row) => row.yearMismatch).length,
      monthMismatches: boundaryRows.filter((row) => row.monthMismatch).length,
    },
    rows: boundaryRows,
  },
  exactBoundaryOffsets: {
    cases: exactBoundaryRows.length,
    exactReferenceDifferences: exactBoundaryRows.filter(
      (row) => row.offsetSeconds === 0 && row.expectedSide !== row.productionSide,
    ).length,
    decisiveSideMismatches: exactBoundaryRows.filter(
      (row) => row.offsetSeconds !== 0 && row.expectedSide !== row.productionSide,
    ).length,
    rows: exactBoundaryRows,
  },
  dayunImpact: {
    fixtures: dayunRows.length,
    maxAbsoluteDeltaSeconds: Math.max(...dayunRows.map((row) => Math.abs(row.deltaSeconds))),
    meanAbsoluteDeltaSeconds:
      dayunRows.reduce((sum, row) => sum + Math.abs(row.deltaSeconds), 0) / dayunRows.length,
    productionPolicyMatches: dayunRows.filter((row) => row.productionMatchesPrecisePolicy).length,
    rows: dayunRows,
  },
  performance: {
    unit: 'milliseconds per 24-term year',
    coldish: { legacy: coldLegacyMs, precise: coldPreciseMs, delta: coldPreciseMs - coldLegacyMs },
    iterations: 100,
    warmAverage: {
      legacy: warmLegacyMs / 100,
      precise: warmPreciseMs / 100,
      delta: (warmPreciseMs - warmLegacyMs) / 100,
    },
  },
};

writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  productionEngine: result.productionEngine,
  jpl240: result.jpl240.statistics,
  naoj120: {
    ...result.naoj120.statistics,
    roundedMinuteMatches: result.naoj120.roundedMinuteMatches,
    withinMinuteSourceTolerance: result.naoj120.withinMinuteSourceTolerance,
  },
  boundary108: result.boundary108.after,
  exactBoundaryOffsets: {
    cases: result.exactBoundaryOffsets.cases,
    exactReferenceDifferences: result.exactBoundaryOffsets.exactReferenceDifferences,
    decisiveSideMismatches: result.exactBoundaryOffsets.decisiveSideMismatches,
  },
  dayunImpact: {
    fixtures: result.dayunImpact.fixtures,
    maxAbsoluteDeltaSeconds: result.dayunImpact.maxAbsoluteDeltaSeconds,
    meanAbsoluteDeltaSeconds: result.dayunImpact.meanAbsoluteDeltaSeconds,
    productionPolicyMatches: result.dayunImpact.productionPolicyMatches,
  },
  performance: result.performance,
}, null, 2));
