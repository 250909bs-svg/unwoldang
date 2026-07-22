import type { Bazi, DayunData, SeunData } from '../../types';
import type { BirthCalculationResult } from '../calendar';
import type { CommercialReleaseAudit } from '../commercialAudit';
import { digestSajuFactsValue } from './digest';
import {
  SAJU_FACTS_SCHEMA_VERSION,
  type CanonicalSajuCalculationInput,
  type SajuCurrentDayunFacts,
  type SajuCurrentFlowFacts,
  type SajuFactsEngineVersions,
  type SajuFactsV1,
  type SajuNatalSelection
} from './types';

export interface BuildSajuFactsV1Args {
  calculation: BirthCalculationResult;
  selectedBazi: Bazi | null;
  selection: SajuNatalSelection;
  invariantPillars: { year: boolean; month: boolean; day: boolean };
  engineVersions: SajuFactsEngineVersions;
  asOf: Date | string;
  dayunRepresentative: DayunData[] | null;
  dayunScenarios: Array<{ scenarioId: string; rows: DayunData[] }>;
  dayunCurrent: SajuCurrentDayunFacts | null;
  seun: SeunData[];
  currentFlow: Omit<SajuCurrentFlowFacts, 'asOf'>;
  releaseAudit: CommercialReleaseAudit;
  uncertainty: string[];
}

function normalizeAsOf(value: Date | string) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error('facts 기준시각이 올바르지 않습니다.');
  }
  return date.toISOString();
}

function canonicalInput(calculation: BirthCalculationResult): CanonicalSajuCalculationInput {
  const context = calculation.context;
  const verifiedLongitude = context.location?.source === 'verified-coordinates'
    ? context.location.longitude ?? null
    : null;

  return {
    gender: context.gender,
    calendar: context.calendar,
    isLeapMonth: context.isLeapMonth,
    date: { ...context.date },
    time: {
      precision: context.time.precision,
      hour: context.time.hour,
      minute: context.time.minute,
      representativeDayOffset: context.time.representativeDayOffset,
      range: context.time.range ? { ...context.time.range } : null
    },
    timezone: {
      id: context.timezone.id,
      utcOffsetMinutes: context.timezone.utcOffsetMinutes
    },
    location: {
      longitude: verifiedLongitude,
      source: verifiedLongitude === null ? 'unavailable' : 'verified-coordinates'
    },
    policies: {
      dayBoundary: context.dayBoundaryPolicy,
      trueSolarTime: {
        enabled: context.trueSolarTime.enabled,
        includeEquationOfTime: context.trueSolarTime.includeEquationOfTime
      }
    }
  };
}

export function buildSajuFactsV1(args: BuildSajuFactsV1Args): SajuFactsV1 {
  const asOf = normalizeAsOf(args.asOf);
  const input = canonicalInput(args.calculation);
  const exactStable = Boolean(
    args.selectedBazi &&
    args.selection === 'primary' &&
    input.time.precision === 'exact-minute'
  );
  const canRepresentDayun = Boolean(
    args.selectedBazi &&
    input.time.precision !== 'unknown' &&
    args.dayunRepresentative
  );
  const representative = canRepresentDayun ? args.dayunRepresentative : null;
  const body: Omit<SajuFactsV1, 'digests'> = {
    schemaVersion: SAJU_FACTS_SCHEMA_VERSION,
    engineVersions: { ...args.engineVersions },
    asOf,
    input,
    natal: {
      status: !args.selectedBazi ? 'ambiguous' : exactStable ? 'stable' : 'degraded',
      selection: args.selection,
      selected: args.selectedBazi,
      scenarios: args.calculation.scenarios.map(({ scenario, bazi, trace }) => ({
        scenario: { ...scenario },
        bazi,
        trace
      })),
      invariantPillars: { ...args.invariantPillars }
    },
    dayun: {
      status: exactStable
        ? 'stable'
        : args.selectedBazi && args.dayunScenarios.length > 0
          ? 'scenario-dependent'
          : 'unavailable',
      representativeKind: representative
        ? input.time.precision === 'exact-minute' ? 'exact' : 'range-midpoint'
        : 'none',
      representative,
      scenarios: args.dayunScenarios.map(({ scenarioId, rows }) => ({ scenarioId, rows })),
      current: representative ? args.dayunCurrent : null
    },
    seun: args.seun,
    currentFlow: { ...args.currentFlow, asOf },
    release: {
      decision: args.releaseAudit.decision,
      audit: args.releaseAudit,
      uncertainty: [...args.uncertainty]
    }
  };

  return {
    ...body,
    digests: {
      input: digestSajuFactsValue({
        schemaVersion: body.schemaVersion,
        engineVersions: body.engineVersions,
        asOf: body.asOf,
        input: body.input
      }),
      facts: digestSajuFactsValue(body),
      algorithm: 'fnv1a-128-v1'
    }
  };
}
