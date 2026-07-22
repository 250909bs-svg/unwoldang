import type { IntakeFormData } from '../../../../api/mockData';
import { calcBazi } from '../../baziCalcs';
import type { Bazi } from '../../types';
import { addDays } from './dateMath';
import { normalizeIntakeFormToBirthContext } from './normalize';
import {
  applyDayBoundaryPolicy,
  applyTrueSolarTime,
  didSolarCorrectionChangeDate,
  renderInstantInKst
} from './solarTime';
import { buildBirthTimeScenarios } from './timeParser';
import type {
  BirthContext,
  BirthContextOptions,
  BirthScenarioResult,
  CalculationTrace,
  CivilDate,
  CivilDateTime
} from './types';

export const CALENDAR_ENGINE_VERSION = 'calendar-v2.0.0' as const;

export interface BirthCalculationResult {
  version: typeof CALENDAR_ENGINE_VERSION;
  context: BirthContext;
  /** Null for unknown time; consumers must compare all 12 scenarios instead. */
  primary: BirthScenarioResult | null;
  scenarios: BirthScenarioResult[];
  trace: CalculationTrace | null;
  warnings: string[];
}

function normalizeInputDateToSolar(context: BirthContext): { solarDate: CivilDate; lunarInput: string | null } {
  const baseline = calcBazi(
    context.date.year,
    context.date.month,
    context.date.day,
    12,
    0,
    context.calendar,
    context.isLeapMonth ? 'leap' : 'normal',
    context.gender,
    false
  );

  return {
    solarDate: {
      year: baseline.solar[0],
      month: baseline.solar[1],
      day: baseline.solar[2]
    },
    lunarInput: baseline.lunar_in
  };
}

function calculateScenario(
  context: BirthContext,
  normalizedSolarDate: CivilDate,
  lunarInput: string | null,
  scenario: ReturnType<typeof buildBirthTimeScenarios>[number]
): BirthScenarioResult {
  const scenarioDate = addDays(normalizedSolarDate, scenario.sourceDayOffset);
  const inputCivilDateTime: CivilDateTime = {
    ...scenarioDate,
    hour: scenario.hour,
    minute: scenario.minute
  };

  // The physical birth instant controls solar-term boundaries (year/month) and
  // daeyun distance. Render it in KST because the legacy core's astronomy is KST.
  const instantInKst = renderInstantInKst(
    inputCivilDateTime,
    context.timezone.utcOffsetMinutes
  );
  const instantBazi = calcBazi(
    instantInKst.year,
    instantInKst.month,
    instantInKst.day,
    instantInKst.hour,
    instantInKst.minute,
    'solar',
    'normal',
    context.gender,
    false
  );

  // Apparent solar clock controls the local day/hour pillars. This is separate
  // from the global instant so overseas births do not move solar-term boundaries.
  const solarTimeCorrection = applyTrueSolarTime(inputCivilDateTime, context);
  const apparent = solarTimeCorrection.apparentSolarDateTime;
  const dayBoundary = applyDayBoundaryPolicy(apparent, context.dayBoundaryPolicy);
  const localPillarBazi = calcBazi(
    dayBoundary.effectivePillarDate.year,
    dayBoundary.effectivePillarDate.month,
    dayBoundary.effectivePillarDate.day,
    apparent.hour,
    apparent.minute,
    'solar',
    'normal',
    context.gender,
    false
  );

  const bazi: Bazi = {
    ...instantBazi,
    d_gz: localPillarBazi.d_gz,
    h_gz: localPillarBazi.h_gz,
    solar: [normalizedSolarDate.year, normalizedSolarDate.month, normalizedSolarDate.day],
    lunar_in: lunarInput
  };

  const warnings = [...context.time.warnings];
  if (solarTimeCorrection.reason === 'missing-verified-longitude') {
    warnings.push('검증된 경도가 없어 진태양시 보정을 적용하지 않았습니다.');
  }
  if (didSolarCorrectionChangeDate(solarTimeCorrection)) {
    warnings.push('진태양시 보정으로 현지 달력 날짜가 변경되었습니다.');
  }
  if (dayBoundary.triggered) {
    warnings.push('야자시 정책에 따라 일주 계산일을 다음 날로 이동했습니다.');
  }

  return {
    scenario,
    bazi,
    trace: {
      scenarioId: scenario.id,
      inputCalendar: context.calendar,
      inputDate: context.date,
      normalizedSolarDate,
      inputTimePrecision: context.time.precision,
      inputCivilDateTime,
      timezone: context.timezone,
      instantInKst,
      solarTimeCorrection,
      dayBoundary,
      warnings
    }
  };
}

/** Calculates a normalized context and preserves every time-uncertainty branch. */
export function calculateBirthContext(context: BirthContext): BirthCalculationResult {
  if (context.calendar === 'solar' && context.isLeapMonth) {
    throw new Error('\uC724\uB2EC\uC740 \uC74C\uB825 \uC0DD\uB144\uC6D4\uC77C\uC5D0\uB9CC \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.');
  }
  const { solarDate, lunarInput } = normalizeInputDateToSolar(context);
  const scenarioInputs = buildBirthTimeScenarios(context.time);
  const scenarios = scenarioInputs.map((scenario) =>
    calculateScenario(context, solarDate, lunarInput, scenario)
  );
  const primary = context.time.precision === 'unknown' ? null : scenarios[0] || null;
  const warnings = Array.from(new Set(scenarios.flatMap((scenario) => scenario.trace.warnings)));

  return {
    version: CALENDAR_ENGINE_VERSION,
    context,
    primary,
    scenarios,
    trace: primary?.trace || null,
    warnings
  };
}

/**
 * Public one-call adapter for the existing intake form. This is the integration
 * entry point intended for report/domain engines.
 */
export function buildBirthCalculation(
  input: Partial<IntakeFormData>,
  options: BirthContextOptions = {}
): BirthCalculationResult {
  return calculateBirthContext(normalizeIntakeFormToBirthContext(input, options));
}
