import type { Bazi } from '../../types';

/**
 * The day-pillar boundary is a school-level policy, not a hidden implementation
 * detail. `late-zi-next-day` treats 23:00-23:59 apparent solar time as the next
 * sexagenary day, while `civil-midnight` changes the day at 00:00.
 */
export type DayBoundaryPolicy = 'civil-midnight' | 'late-zi-next-day';

export type BirthTimePrecision = 'exact-minute' | 'legacy-range' | 'unknown';

export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

export interface CivilDateTime extends CivilDate {
  hour: number;
  minute: number;
}

export interface BirthTimeRange {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  /** True when the range ends on the following civil day. */
  crossesMidnight: boolean;
}

export interface ParsedBirthTime {
  raw: string | null;
  precision: BirthTimePrecision;
  hour: number | null;
  minute: number | null;
  representativeDayOffset: number;
  representativeStrategy: 'provided' | 'range-midpoint' | 'unknown-scenarios';
  range: BirthTimeRange | null;
  warnings: string[];
}

export interface BirthLocation {
  /** Human-readable value entered by the user. It is never geocoded implicitly. */
  label?: string;
  latitude?: number;
  longitude?: number;
  source: 'user-text' | 'verified-coordinates';
}

export interface BirthTimeZone {
  /** IANA identifier retained for audit and future historical-timezone lookup. */
  id: string;
  /** Offset that applied at the birth instant. KST defaults to +540. */
  utcOffsetMinutes: number;
  source: 'korea-default' | 'explicit';
}

export interface TrueSolarTimePolicy {
  enabled: boolean;
  /** Apparent solar time includes the astronomical equation of time. */
  includeEquationOfTime: boolean;
}

export interface BirthContext {
  name: string;
  gender: 'male' | 'female';
  calendar: 'solar' | 'lunar';
  isLeapMonth: boolean;
  date: CivilDate;
  time: ParsedBirthTime;
  location: BirthLocation | null;
  timezone: BirthTimeZone;
  trueSolarTime: TrueSolarTimePolicy;
  dayBoundaryPolicy: DayBoundaryPolicy;
}

export interface BirthContextOptions {
  timezoneId?: string;
  utcOffsetMinutes?: number;
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
  applyTrueSolarTime?: boolean;
  includeEquationOfTime?: boolean;
  dayBoundaryPolicy?: DayBoundaryPolicy;
}

export interface SolarTimeCorrectionTrace {
  requested: boolean;
  applied: boolean;
  reason: 'applied' | 'disabled' | 'missing-verified-longitude';
  longitude: number | null;
  standardMeridianLongitude: number;
  longitudeCorrectionMinutes: number;
  equationOfTimeMinutes: number;
  totalCorrectionMinutes: number;
  appliedCorrectionMinutes: number;
  inputCivilDateTime: CivilDateTime;
  apparentSolarDateTime: CivilDateTime;
  civilDateShift: number;
}

export interface DayBoundaryTrace {
  policy: DayBoundaryPolicy;
  threshold: '00:00' | '23:00';
  triggered: boolean;
  shiftDays: 0 | 1;
  apparentSolarDate: CivilDate;
  effectivePillarDate: CivilDate;
  reason: 'civil-midnight' | 'late-zi-triggered' | 'before-late-zi';
}

export interface CalculationTrace {
  scenarioId: string;
  inputCalendar: 'solar' | 'lunar';
  inputDate: CivilDate;
  normalizedSolarDate: CivilDate;
  inputTimePrecision: BirthTimePrecision;
  inputCivilDateTime: CivilDateTime;
  timezone: BirthTimeZone;
  /** Same physical instant rendered in KST for the legacy astronomical core. */
  instantInKst: CivilDateTime;
  solarTimeCorrection: SolarTimeCorrectionTrace;
  dayBoundary: DayBoundaryTrace;
  warnings: string[];
}

export interface BirthTimeScenario {
  id: string;
  label: string;
  branchIndex: number | null;
  hour: number;
  minute: number;
  sourcePrecision: BirthTimePrecision;
  sourceDayOffset: number;
}

export interface BirthScenarioResult {
  scenario: BirthTimeScenario;
  bazi: Bazi;
  trace: CalculationTrace;
}
