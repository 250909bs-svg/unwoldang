import { addDays, addMinutes, compareCivilDate, datePart } from './dateMath';
import type {
  BirthContext,
  CivilDate,
  CivilDateTime,
  DayBoundaryPolicy,
  DayBoundaryTrace,
  SolarTimeCorrectionTrace
} from './types';

function dayOfYear(date: CivilDate): number {
  const start = Date.UTC(date.year, 0, 1);
  const current = Date.UTC(date.year, date.month - 1, date.day);
  return Math.floor((current - start) / 86_400_000) + 1;
}

/**
 * Returns the equation of time in minutes using the standard Spencer/NOAA
 * fractional-year approximation. Accuracy is sufficient for minute-resolution
 * birth input and the approximation is deterministic and dependency-free.
 */
export function calculateEquationOfTimeMinutes(dateTime: CivilDateTime): number {
  const daysInYear = new Date(Date.UTC(dateTime.year, 1, 29)).getUTCMonth() === 1 ? 366 : 365;
  const gamma = (2 * Math.PI / daysInYear)
    * (dayOfYear(dateTime) - 1 + (dateTime.hour - 12) / 24);
  return 229.18 * (
    0.000075
    + 0.001868 * Math.cos(gamma)
    - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma)
    - 0.040849 * Math.sin(2 * gamma)
  );
}

function dayDifference(left: CivilDate, right: CivilDate): number {
  const leftTimestamp = Date.UTC(left.year, left.month - 1, left.day);
  const rightTimestamp = Date.UTC(right.year, right.month - 1, right.day);
  return Math.round((leftTimestamp - rightTimestamp) / 86_400_000);
}

/**
 * Converts legal local clock time to apparent true-solar time:
 *
 *   4 × (longitude − time-zone standard meridian) + equation of time.
 *
 * A free-text location is deliberately insufficient. Without a verified numeric
 * longitude the function returns the input unchanged and records why.
 */
export function applyTrueSolarTime(
  input: CivilDateTime,
  context: Pick<BirthContext, 'timezone' | 'location' | 'trueSolarTime'>
): SolarTimeCorrectionTrace {
  const requested = context.trueSolarTime.enabled;
  const longitude = context.location?.source === 'verified-coordinates'
    ? context.location.longitude ?? null
    : null;
  const standardMeridianLongitude = context.timezone.utcOffsetMinutes / 4;

  if (!requested || longitude === null) {
    return {
      requested,
      applied: false,
      reason: requested ? 'missing-verified-longitude' : 'disabled',
      longitude,
      standardMeridianLongitude,
      longitudeCorrectionMinutes: 0,
      equationOfTimeMinutes: 0,
      totalCorrectionMinutes: 0,
      appliedCorrectionMinutes: 0,
      inputCivilDateTime: input,
      apparentSolarDateTime: input,
      civilDateShift: 0
    };
  }

  const longitudeCorrectionMinutes = 4 * (longitude - standardMeridianLongitude);
  const equationOfTimeMinutes = context.trueSolarTime.includeEquationOfTime
    ? calculateEquationOfTimeMinutes(input)
    : 0;
  const totalCorrectionMinutes = longitudeCorrectionMinutes + equationOfTimeMinutes;
  const appliedCorrectionMinutes = Math.round(totalCorrectionMinutes);
  const apparentSolarDateTime = addMinutes(input, appliedCorrectionMinutes);

  return {
    requested,
    applied: true,
    reason: 'applied',
    longitude,
    standardMeridianLongitude,
    longitudeCorrectionMinutes,
    equationOfTimeMinutes,
    totalCorrectionMinutes,
    appliedCorrectionMinutes,
    inputCivilDateTime: input,
    apparentSolarDateTime,
    civilDateShift: dayDifference(datePart(apparentSolarDateTime), datePart(input))
  };
}

export function applyDayBoundaryPolicy(
  apparentSolarDateTime: CivilDateTime,
  policy: DayBoundaryPolicy
): DayBoundaryTrace {
  const apparentSolarDate = datePart(apparentSolarDateTime);
  const lateZiTriggered = policy === 'late-zi-next-day' && apparentSolarDateTime.hour >= 23;
  const effectivePillarDate = lateZiTriggered ? addDays(apparentSolarDate, 1) : apparentSolarDate;

  return {
    policy,
    threshold: policy === 'late-zi-next-day' ? '23:00' : '00:00',
    triggered: lateZiTriggered,
    shiftDays: lateZiTriggered ? 1 : 0,
    apparentSolarDate,
    effectivePillarDate,
    reason: policy === 'civil-midnight'
      ? 'civil-midnight'
      : lateZiTriggered
        ? 'late-zi-triggered'
        : 'before-late-zi'
  };
}

/** Converts the same physical instant from local legal time to KST components. */
export function renderInstantInKst(input: CivilDateTime, utcOffsetMinutes: number): CivilDateTime {
  return addMinutes(input, 9 * 60 - utcOffsetMinutes);
}

export function didSolarCorrectionChangeDate(trace: SolarTimeCorrectionTrace): boolean {
  return compareCivilDate(
    datePart(trace.apparentSolarDateTime),
    datePart(trace.inputCivilDateTime)
  ) !== 0;
}
