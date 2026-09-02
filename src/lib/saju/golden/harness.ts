import type { IntakeFormData } from '../../../api/mockData';
import { buildDeterministicSajuBasis } from '../deterministicBasis';
import type {
  GoldenExpectedFacts,
  GoldenFactField,
  GoldenFactProvenance,
  GoldenFixture,
  GoldenFixtureCategory,
  GoldenVerificationStatus
} from './schema';
import { goldenFixtureCategories, hasIndependentProvenance } from './schema';

export type GoldenActualFacts = GoldenExpectedFacts;
export type GoldenActualProvider = (fixture: GoldenFixture) => GoldenActualFacts;

export interface GoldenFieldComparison {
  field: GoldenFactField;
  expected: unknown;
  actual: unknown;
  result: 'match' | 'mismatch' | 'not-eligible';
  expectedSource?: GoldenFactProvenance;
  message?: string;
}

export interface GoldenFixtureComparison {
  fixtureId: string;
  category: GoldenFixtureCategory;
  verificationStatus: GoldenVerificationStatus;
  result: 'match' | 'mismatch' | 'pending' | 'no-source-backed-expected' | 'engine-error';
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
  compared: number;
  matches: number;
  mismatches: number;
}

export interface GoldenMatrixSummary {
  total: number;
  verified: number;
  partial: number;
  pending: number;
  comparedFixtures: number;
  fixtureMatches: number;
  fixtureMismatches: number;
  factMatches: number;
  factMismatches: number;
  provenanceWarnings: number;
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

  return {
    normalizedSolarDate: dateLabel(basis.commercialV2.calendar.trace?.normalizedSolarDate),
    leapMonth: basis.input.isLeapMonth,
    yearPillar: basis.pillars.year,
    monthPillar: basis.pillars.month,
    dayPillar: basis.pillars.day,
    hourPillar: basis.pillars.hour,
    dayMaster: basis.dayMaster.stem,
    dayunDirection: inferDayunDirection(basis.pillars.month, firstDayun?.ganzhi),
    dayunStartsAt: firstDayun?.startsAt,
    firstDayun: firstDayun?.ganzhi
  };
};

function comparable(value: unknown) {
  if (value && typeof value === 'object') {
    return JSON.stringify(value, Object.keys(value as object).sort());
  }
  return value;
}

function emptyCategorySummary(): GoldenCategorySummary {
  return { total: 0, verified: 0, partial: 0, pending: 0, compared: 0, matches: 0, mismatches: 0 };
}

function compareFixture(fixture: GoldenFixture, provider: GoldenActualProvider): GoldenFixtureComparison {
  const warnings: string[] = [];
  const boundaryPolicy = {
    lateZiPolicy: fixture.input.lateZiPolicy,
    trueSolarTimePolicy: fixture.input.trueSolarTimePolicy,
    timezone: fixture.input.timezone
  };
  const expectedEntries = Object.entries(fixture.expected) as Array<[GoldenFactField, unknown]>;

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

  const sourceBackedEntries = expectedEntries.filter(([field]) =>
    hasIndependentProvenance(fixture.provenance[field])
  );
  if (sourceBackedEntries.length === 0) {
    return {
      fixtureId: fixture.id,
      category: fixture.category,
      verificationStatus: fixture.verificationStatus,
      result: 'no-source-backed-expected',
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

  const fields = expectedEntries.map(([field, expected]): GoldenFieldComparison => {
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
    return {
      field,
      expected,
      actual: actualValue,
      result: comparable(expected) === comparable(actualValue) ? 'match' : 'mismatch',
      expectedSource: fixture.provenance[field]
    };
  });
  const hasMismatch = fields.some((field) => field.result === 'mismatch');

  return {
    fixtureId: fixture.id,
    category: fixture.category,
    verificationStatus: fixture.verificationStatus,
    result: hasMismatch ? 'mismatch' : 'match',
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

  return {
    summary: {
      total: fixtures.length,
      verified: fixtures.filter((fixture) => fixture.verificationStatus === 'verified').length,
      partial: fixtures.filter((fixture) => fixture.verificationStatus === 'partial').length,
      pending: fixtures.filter((fixture) => fixture.verificationStatus === 'pending').length,
      comparedFixtures: comparisons.filter((item) => ['match', 'mismatch', 'engine-error'].includes(item.result)).length,
      fixtureMatches: comparisons.filter((item) => item.result === 'match').length,
      fixtureMismatches: comparisons.filter((item) => item.result === 'mismatch' || item.result === 'engine-error').length,
      factMatches: comparisons.flatMap((item) => item.fields).filter((field) => field.result === 'match').length,
      factMismatches: comparisons.flatMap((item) => item.fields).filter((field) => field.result === 'mismatch').length,
      provenanceWarnings: comparisons.reduce((sum, item) => sum + item.warnings.length, 0),
      categories
    },
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
    if (fixture.verificationStatus === 'verified' && expectedFields.length === 0) {
      errors.push(`${fixture.id}: verified fixture has no expected FACT.`);
    }
    if (fixture.verificationStatus === 'verified') {
      for (const field of expectedFields) {
        if (!hasIndependentProvenance(fixture.provenance[field])) {
          errors.push(`${fixture.id}.${field}: verified expected FACT lacks independent provenance.`);
        }
      }
    }
  }

  return errors;
}
