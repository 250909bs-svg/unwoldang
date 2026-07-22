import type { Bazi, DayunData, GZ, SeunData } from '../../types';
import type { CommercialReleaseAudit } from '../commercialAudit';
import type {
  BirthTimePrecision,
  BirthTimeRange,
  BirthTimeScenario,
  CalculationTrace,
  CivilDate
} from '../calendar';

export const SAJU_FACTS_SCHEMA_VERSION = 'saju-facts-v1' as const;

export type SajuNatalStatus = 'stable' | 'ambiguous' | 'degraded';
export type SajuNatalSelection =
  | 'primary'
  | 'range-midpoint'
  | 'stable-without-hour'
  | 'unstable-day';

export interface SajuFactsEngineVersions {
  myeongri: string;
  calendar: string;
  interpretation: string;
  interaction: string | null;
  compatibility: string | null;
  releaseAudit: string;
}

export interface CanonicalSajuCalculationInput {
  gender: 'male' | 'female';
  calendar: 'solar' | 'lunar';
  isLeapMonth: boolean;
  date: CivilDate;
  time: {
    precision: BirthTimePrecision;
    hour: number | null;
    minute: number | null;
    representativeDayOffset: number;
    range: BirthTimeRange | null;
  };
  timezone: {
    id: string;
    utcOffsetMinutes: number;
  };
  location: {
    /** Only the calculation-bearing coordinate is retained; labels and names are excluded. */
    longitude: number | null;
    source: 'verified-coordinates' | 'unavailable';
  };
  policies: {
    dayBoundary: 'civil-midnight' | 'late-zi-next-day';
    trueSolarTime: {
      enabled: boolean;
      includeEquationOfTime: boolean;
    };
  };
}

export interface SajuFactsScenario {
  scenario: BirthTimeScenario;
  bazi: Bazi;
  trace: CalculationTrace;
}

export interface SajuNatalFacts {
  status: SajuNatalStatus;
  selection: SajuNatalSelection;
  selected: Bazi | null;
  scenarios: SajuFactsScenario[];
  invariantPillars: {
    year: boolean;
    month: boolean;
    day: boolean;
  };
}

export interface SajuDayunScenarioFacts {
  scenarioId: string;
  rows: DayunData[];
}

export interface SajuCurrentDayunFacts {
  phase: 'pre-dayun' | 'active';
  currentIndex: number | null;
  current: DayunData | null;
  next: DayunData | null;
}

export interface SajuDayunFacts {
  status: 'stable' | 'scenario-dependent' | 'unavailable';
  representativeKind: 'exact' | 'range-midpoint' | 'none';
  representative: DayunData[] | null;
  scenarios: SajuDayunScenarioFacts[];
  current: SajuCurrentDayunFacts | null;
}

export interface SajuCurrentFlowFacts {
  asOf: string;
  timezone: string;
  referenceClock: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  };
  referenceClockKst: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  };
  seunStartYear: number;
  pillars: {
    year: GZ;
    month: GZ;
    day: GZ;
    hour: GZ | null;
  };
}

/**
 * Calculation-only, explicitly versioned facts passed between the deterministic
 * engine and narrative generation. Direct identifiers, free-text location
 * labels, customer questions, and product copy are intentionally excluded.
 */
export interface SajuFactsV1 {
  schemaVersion: typeof SAJU_FACTS_SCHEMA_VERSION;
  engineVersions: SajuFactsEngineVersions;
  asOf: string;
  input: CanonicalSajuCalculationInput;
  natal: SajuNatalFacts;
  dayun: SajuDayunFacts;
  seun: SeunData[];
  currentFlow: SajuCurrentFlowFacts;
  release: {
    decision: CommercialReleaseAudit['decision'];
    audit: CommercialReleaseAudit;
    uncertainty: string[];
  };
  digests: {
    /** Browser-safe deterministic identity digest; not an authorization token. */
    input: string;
    facts: string;
    algorithm: 'fnv1a-128-v1';
  };
}
