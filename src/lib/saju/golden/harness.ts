import type { IntakeFormData } from '../../../api/mockData';
import { buildDeterministicSajuBasis } from '../deterministicBasis';
import { getSolarTermInstantForGregorianYear } from '../sxtwl';
import type {
  GoldenExpectedFacts,
  GoldenFactField,
  GoldenFactProvenance,
  GoldenFixture,
  GoldenFixtureCategory,
  GoldenVerificationStatus
} from './schema';
import { deriveGoldenFixtureStatus, goldenFixtureCategories, hasIndependentProvenance } from './schema';

export type GoldenActualFacts = GoldenExpectedFacts;
export type GoldenActualProvider = (fixture: GoldenFixture) => GoldenActualFacts;

export interface GoldenFieldComparison {
  field: GoldenFactField;
  expected: unknown;
  actual: unknown;
  result: 'match' | 'mismatch' | 'not-eligible';
  expectedSource?: GoldenFactProvenance;
  message?: string;
  classification?: 'ENGINE_BUG_CONFIRMED' | 'EXPECTED_DATA_ERROR' | 'POLICY_DIFFERENCE' | 'SOURCE_CONFLICT' | 'INSUFFICIENT_EVIDENCE';
}

export interface GoldenFixtureComparison {
  fixtureId: string;
  category: GoldenFixtureCategory;
  verificationStatus: GoldenVerificationStatus;
  result: 'match' | 'mismatch' | 'pending' | 'source-conflict' | 'no-source-backed-expected' | 'engine-error';
  fields: GoldenFieldComparison[];
  warnings: string[];
  boundaryPolicy: {
    lateZiPolicy: GoldenFixture['input']['lateZiPolicy'];
    trueSolarTimePolicy: GoldenFixture['input']['trueSolarTimePolicy'];
    timezone: string;
  };
  error?: string;
}

export interface GoldenCategorySummary {
  total: number;
  verified: number;
  partial: number;
  pending: number;
  conflicting: number;
  compared: number;
  matches: number;
  mismatches: number;
}

export interface GoldenMatrixSummary {
  total: number;
  verified: number;
  partial: number;
  pending: number;
  conflicting: number;
  comparedFixtures: number;
  fixtureMatches: number;
  fixtureMismatches: number;
  factMatches: number;
  factMismatches: number;
  verifiedFactFields: number;
  conflictingFactFields: number;
  unexplainedMismatches: number;
  provenanceWarnings: number;
  sourceTierCounts: Record<'A' | 'B' | 'C' | 'D' | 'E', number>;
  sourceChecks: {
    kasi: number;
    independentManse: number;
    standardTable: number;
    expert: number;
  };
  releaseGate: 'PASS' | 'NO-GO';
  categories: Record<GoldenFixtureCategory, GoldenCategorySummary>;
}

export interface GoldenMatrixReport {
  summary: GoldenMatrixSummary;
  fixtures: GoldenFixtureComparison[];
}

const KOREAN_STEMS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
const KOREAN_BRANCHES = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];

function dateLabel(value: { year: number; month: number; day: number } | null | undefined) {
  if (!value) return undefined;
  return `${value.year}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`;
}

function inferDayunDirection(monthPillar: string, firstDayun: string | undefined) {
  if (!firstDayun) return undefined;
  const monthStem = KOREAN_STEMS.indexOf(monthPillar[0]);
  const monthBranch = KOREAN_BRANCHES.indexOf(monthPillar[1]);
  const firstStem = KOREAN_STEMS.indexOf(firstDayun[0]);
  const firstBranch = KOREAN_BRANCHES.indexOf(firstDayun[1]);
  if ([monthStem, monthBranch, firstStem, firstBranch].some((value) => value < 0)) return undefined;

  if ((monthStem + 1) % 10 === firstStem && (monthBranch + 1) % 12 === firstBranch) {
    return 'forward' as const;
  }
  if ((monthStem + 9) % 10 === firstStem && (monthBranch + 11) % 12 === firstBranch) {
    return 'reverse' as const;
  }
  return undefined;
}

const SOLAR_TERM_ANGLES: Record<string, number> = {
  입춘: 315,
  경칩: 345,
  청명: 15,
  입하: 45,
  망종: 75,
  소서: 105,
  입추: 135,
  백로: 165,
  한로: 195,
  입동: 225
};

function fixtureInstant(fixture: GoldenFixture, utcOffsetMinutes: number) {
  if (!fixture.input.birthTime || !/^\d{2}:\d{2}$/.test(fixture.input.birthTime)) return undefined;
  const [year, month, day] = fixture.input.birthDate.split('-').map(Number);
  const [hour, minute] = fixture.input.birthTime.split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - utcOffsetMinutes * 60_000);
}

function roundInstantToMinute(value: Date | undefined) {
  if (!value) return undefined;
  return new Date(Math.round(value.getTime() / 60_000) * 60_000);
}

export function goldenFixtureToIntake(fixture: GoldenFixture): IntakeFormData {
  const { input } = fixture;
  const unknownTime = input.birthTimePrecision === 'unknown';
  const birthLocation = {
    label: input.location.label,
    latitude: input.location.latitude,
    longitude: input.location.longitude,
    timezone: input.timezone,
    utcOffsetMinutes: input.location.utcOffsetMinutes,
    applySolarTimeCorrection: input.trueSolarTimePolicy === 'apparent-solar-time'
  };

  return {
    name: `golden-${fixture.id}`,
    gender: input.gender,
    calendar: input.calendarType,
    isLeapMonth: input.leapMonth,
    birthDate: input.birthDate,
    birthTime: input.birthTime || '',
    isUnknownTime: unknownTime,
    birthTimePrecision: input.birthTimePrecision,
    dayBoundaryPolicy: input.lateZiPolicy === 'late-zi-next-day' ? 'late-zi' : 'midnight',
    birthLocation,
    timezone: input.timezone,
    utcOffsetMinutes: input.location.utcOffsetMinutes,
    latitude: input.location.latitude,
    longitude: input.location.longitude,
    applySolarTimeCorrection: input.trueSolarTimePolicy === 'apparent-solar-time',
    relationshipStatus: 'single',
    relationshipDuration: 'under1',
    location: input.location.label,
    q1: '이 명식의 핵심 흐름을 알려주세요.',
    q2: '현재 선택에서 주의할 점을 알려주세요.'
  };
}

export const runCurrentDeterministicFacts: GoldenActualProvider = (fixture) => {
  const basis = buildDeterministicSajuBasis('general-signature', goldenFixtureToIntake(fixture));
  const firstDayun = basis.dayun[0];
  const utcOffsetMinutes = basis.input.timezoneContext.utcOffsetMinutes;
  const normalizedInstant = fixtureInstant(fixture, utcOffsetMinutes)?.toISOString();
  const termAngle = fixture.boundaryReference?.kind === 'solar-term'
    ? SOLAR_TERM_ANGLES[fixture.boundaryReference.label]
    : undefined;
  const termInstant = roundInstantToMinute(termAngle === undefined
    ? undefined
    : getSolarTermInstantForGregorianYear(Number(fixture.input.birthDate.slice(0, 4)), termAngle));
  const inputInstant = fixtureInstant(fixture, fixture.input.location.utcOffsetMinutes ?? 540);

  return {
    normalizedSolarDate: dateLabel(basis.commercialV2.calendar.trace?.normalizedSolarDate),
    leapMonth: fixture.input.calendarType === 'lunar' ? basis.input.isLeapMonth : undefined,
    yearPillar: basis.pillars.year,
    monthPillar: basis.pillars.month,
    dayPillar: basis.pillars.day,
    hourPillar: basis.pillars.hour,
    dayMaster: basis.dayMaster.stem,
    dayunDirection: inferDayunDirection(basis.pillars.month, firstDayun?.ganzhi),
    dayunStartsAt: firstDayun?.startsAt,
    firstDayun: firstDayun?.ganzhi
    ,solarTermBoundaryInstant: termInstant?.toISOString()
    ,boundaryRelativeMinutes: termInstant && inputInstant
      ? Math.round((inputInstant.getTime() - termInstant.getTime()) / 60_000)
      : undefined
    ,utcOffsetMinutes
    ,normalizedInstant
  };
};

function comparable(value: unknown) {
  if (value && typeof value === 'object') {
    return JSON.stringify(value, Object.keys(value as object).sort());
  }
  return value;
}

function classifyMismatch(
  field: GoldenFactField,
  source: GoldenFactProvenance | undefined,
  expected: unknown,
  actual: unknown
) {
  if (
    source?.sourceTier === 'A' &&
    source.sourceId === 'naoj-reki-yoko-2024' &&
    (field === 'solarTermBoundaryInstant' || field === 'boundaryRelativeMinutes')
  ) {
    // NAOJ publishes these instants at minute precision. Keep the mismatch
    // visible, but do not call a one-minute rounding-bin difference an engine
    // bug after the independent JPL second-level comparison has passed.
    if (field === 'solarTermBoundaryInstant' && typeof expected === 'string' && typeof actual === 'string') {
      const delta = Math.abs(Date.parse(expected) - Date.parse(actual));
      if (Number.isFinite(delta) && delta <= 60_000) return 'INSUFFICIENT_EVIDENCE' as const;
    }
    if (field === 'boundaryRelativeMinutes' && typeof expected === 'number' && typeof actual === 'number') {
      if (Math.abs(expected - actual) <= 1) return 'INSUFFICIENT_EVIDENCE' as const;
    }
    return 'ENGINE_BUG_CONFIRMED' as const;
  }
  return undefined;
}

function emptyCategorySummary(): GoldenCategorySummary {
  return { total: 0, verified: 0, partial: 0, pending: 0, conflicting: 0, compared: 0, matches: 0, mismatches: 0 };
}

function compareFixture(fixture: GoldenFixture, provider: GoldenActualProvider): GoldenFixtureComparison {
  const warnings: string[] = [];
  const boundaryPolicy = {
    lateZiPolicy: fixture.input.lateZiPolicy,
    trueSolarTimePolicy: fixture.input.trueSolarTimePolicy,
    timezone: fixture.input.timezone
  };
  const expectedEntries = Object.entries(fixture.expected) as Array<[GoldenFactField, unknown]>;
  const eligibleEntries = expectedEntries.filter(([field]) =>
    ['verified', 'conflicting'].includes(fixture.fieldVerification?.[field] || '')
  );

  for (const [field] of expectedEntries) {
    if (!hasIndependentProvenance(fixture.provenance[field])) {
      warnings.push(`${fixture.id}.${field}: independent provenance is missing or unverified.`);
    }
  }

  if (fixture.verificationStatus === 'pending') {
    return {
      fixtureId: fixture.id,
      category: fixture.category,
      verificationStatus: 'pending',
      result: 'pending',
      fields: [],
      warnings,
      boundaryPolicy
    };
  }

  const sourceBackedEntries = eligibleEntries.filter(([field]) =>
    hasIndependentProvenance(fixture.provenance[field])
  );
  if (sourceBackedEntries.length === 0) {
    return {
      fixtureId: fixture.id,
      category: fixture.category,
      verificationStatus: fixture.verificationStatus,
      result: fixture.verificationStatus === 'conflicting' ? 'source-conflict' : 'no-source-backed-expected',
      fields: expectedEntries.map(([field, expected]) => ({
        field,
        expected,
        actual: undefined,
        result: 'not-eligible',
        expectedSource: fixture.provenance[field],
        message: 'Expected value is excluded from golden PASS because provenance is absent.'
      })),
      warnings,
      boundaryPolicy
    };
  }

  let actual: GoldenActualFacts;
  try {
    actual = provider(fixture);
  } catch (error) {
    return {
      fixtureId: fixture.id,
      category: fixture.category,
      verificationStatus: fixture.verificationStatus,
      result: 'engine-error',
      fields: [],
      warnings,
      boundaryPolicy,
      error: error instanceof Error ? error.message : String(error)
    };
  }

  const fields = eligibleEntries.map(([field, expected]): GoldenFieldComparison => {
    if (!hasIndependentProvenance(fixture.provenance[field])) {
      return {
        field,
        expected,
        actual: actual[field],
        result: 'not-eligible',
        expectedSource: fixture.provenance[field]
      };
    }
    const actualValue = actual[field];
    if (actualValue === undefined) {
      return {
        field,
        expected,
        actual: actualValue,
        result: 'not-eligible',
        expectedSource: fixture.provenance[field],
        message: 'The current engine does not expose this FACT in the comparison contract.'
      };
    }
    const matches = comparable(expected) === comparable(actualValue);
    return {
      field,
      expected,
      actual: actualValue,
      result: matches ? 'match' : 'mismatch',
      expectedSource: fixture.provenance[field],
      classification: matches
        ? undefined
        : classifyMismatch(field, fixture.provenance[field], expected, actualValue)
    };
  });
  const hasMismatch = fields.some((field) => field.result === 'mismatch');

  return {
    fixtureId: fixture.id,
    category: fixture.category,
    verificationStatus: fixture.verificationStatus,
    result: fixture.verificationStatus === 'conflicting' ? 'source-conflict' : hasMismatch ? 'mismatch' : 'match',
    fields,
    warnings,
    boundaryPolicy
  };
}

export function evaluateGoldenMatrix(
  fixtures: GoldenFixture[],
  provider: GoldenActualProvider = runCurrentDeterministicFacts
): GoldenMatrixReport {
  const categories = Object.fromEntries(
    goldenFixtureCategories.map((category) => [category, emptyCategorySummary()])
  ) as Record<GoldenFixtureCategory, GoldenCategorySummary>;
  const comparisons = fixtures.map((fixture) => compareFixture(fixture, provider));
  const activeProvenance = fixtures.flatMap((fixture) =>
    (fixture.targetFields || []).flatMap((field) => {
      const status = fixture.fieldVerification?.[field];
      const source = fixture.provenance[field];
      return status && status !== 'pending' && status !== 'not-applicable' && source ? [source] : [];
    })
  );

  for (const comparison of comparisons) {
    const category = categories[comparison.category];
    category.total += 1;
    category[comparison.verificationStatus] += 1;
    if (comparison.result === 'match' || comparison.result === 'mismatch' || comparison.result === 'engine-error') {
      category.compared += 1;
    }
    if (comparison.result === 'match') category.matches += 1;
    if (comparison.result === 'mismatch' || comparison.result === 'engine-error') category.mismatches += 1;
  }

  const summary: GoldenMatrixSummary = {
      total: fixtures.length,
      verified: fixtures.filter((fixture) => fixture.verificationStatus === 'verified').length,
      partial: fixtures.filter((fixture) => fixture.verificationStatus === 'partial').length,
      pending: fixtures.filter((fixture) => fixture.verificationStatus === 'pending').length,
      conflicting: fixtures.filter((fixture) => fixture.verificationStatus === 'conflicting').length,
      comparedFixtures: comparisons.filter((item) => ['match', 'mismatch', 'engine-error'].includes(item.result)).length,
      fixtureMatches: comparisons.filter((item) => item.result === 'match').length,
      fixtureMismatches: comparisons.filter((item) => item.result === 'mismatch' || item.result === 'engine-error').length,
      factMatches: comparisons.flatMap((item) => item.fields).filter((field) => field.result === 'match').length,
      factMismatches: comparisons.flatMap((item) => item.fields).filter((field) => field.result === 'mismatch').length,
      verifiedFactFields: fixtures.reduce(
        (sum, fixture) => sum + Object.values(fixture.fieldVerification || {}).filter((status) => status === 'verified').length,
        0
      ),
      conflictingFactFields: fixtures.reduce(
        (sum, fixture) => sum + Object.values(fixture.fieldVerification || {}).filter((status) => status === 'conflicting').length,
        0
      ),
      unexplainedMismatches: comparisons
        .filter((item) => item.verificationStatus !== 'conflicting')
        .flatMap((item) => item.fields)
        .filter((field) => field.result === 'mismatch' && !field.classification).length,
      provenanceWarnings: comparisons.reduce((sum, item) => sum + item.warnings.length, 0),
      sourceTierCounts: {
        A: activeProvenance.filter((source) => source.sourceTier === 'A').length,
        B: activeProvenance.filter((source) => source.sourceTier === 'B').length,
        C: activeProvenance.filter((source) => source.sourceTier === 'C').length,
        D: activeProvenance.filter((source) => source.sourceTier === 'D').length,
        E: activeProvenance.filter((source) => source.sourceTier === 'E').length
      },
      sourceChecks: {
        kasi: activeProvenance.filter((source) => source.sourceId?.startsWith('kasi-')).length,
        independentManse: activeProvenance.filter((source) => source.sourceType === 'approved-independent-manse').length,
        standardTable: activeProvenance.filter((source) => source.sourceTier === 'C').length,
        expert: activeProvenance.filter((source) => source.sourceType === 'expert-review').length
      },
      releaseGate: 'NO-GO',
      categories
    };
  summary.releaseGate = summary.verified === summary.total && summary.partial === 0 &&
    summary.pending === 0 && summary.conflicting === 0 && summary.factMismatches === 0
    ? 'PASS'
    : 'NO-GO';

  return {
    summary,
    fixtures: comparisons
  };
}

export function validateGoldenFixtureDefinitions(fixtures: GoldenFixture[]) {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const fixture of fixtures) {
    if (ids.has(fixture.id)) errors.push(`${fixture.id}: duplicate fixture id.`);
    ids.add(fixture.id);

    const expectedFields = Object.keys(fixture.expected) as GoldenFactField[];
    const targetFields = fixture.targetFields || expectedFields;
    if (
      fixture.fieldVerification &&
      fixture.verificationStatus !== deriveGoldenFixtureStatus(targetFields, fixture.fieldVerification)
    ) {
      errors.push(`${fixture.id}: fixture status does not match field verification states.`);
    }
    if (fixture.verificationStatus === 'verified' && expectedFields.length === 0) {
      errors.push(`${fixture.id}: verified fixture has no expected FACT.`);
    }
    if (fixture.verificationStatus === 'verified') {
      for (const field of targetFields) {
        if (!hasIndependentProvenance(fixture.provenance[field])) {
          errors.push(`${fixture.id}.${field}: verified expected FACT lacks independent provenance.`);
        }
        if (fixture.fieldVerification?.[field] !== 'verified') {
          errors.push(`${fixture.id}.${field}: fixture is verified but field is not verified.`);
        }
      }
    }
  }

  return errors;
}
