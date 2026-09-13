import { Body, Equator, Observer, SiderealTime } from 'astronomy-engine';
import { addDays, addMinutes, compareCivilDate, datePart } from './dateMath';
import type {
  BirthContext,
  CivilDate,
  CivilDateTime,
  DayBoundaryPolicy,
  DayBoundaryTrace,
  SolarTimeCorrectionTrace
} from './types';

export const TRUE_SOLAR_TIME_ENGINE_VERSION = 'astronomy-engine-2.1.19' as const;

const GREENWICH_OBSERVER = new Observer(0, 0, 0);

function wrapHours(value: number) {
  return ((value + 12) % 24 + 24) % 24 - 12;
}

/**
 * Returns apparent-solar minus mean-solar time in minutes. The civil components
 * are converted to their physical UTC instant before the Sun's apparent
 * right ascension and Greenwich apparent sidereal time are evaluated.
 */
export function calculateEquationOfTimeMinutes(
  dateTime: CivilDateTime,
  utcOffsetMinutes = 0
): number {
  const utcInstant = new Date(
    Date.UTC(
      dateTime.year,
      dateTime.month - 1,
      dateTime.day,
      dateTime.hour,
      dateTime.minute
    ) - utcOffsetMinutes * 60_000
  );
  const sun = Equator(Body.Sun, utcInstant, GREENWICH_OBSERVER, true, true);
  const apparentSolarHours = (SiderealTime(utcInstant) - sun.ra + 12 + 24) % 24;
  const meanSolarHours = utcInstant.getUTCHours()
    + utcInstant.getUTCMinutes() / 60
    + utcInstant.getUTCSeconds() / 3_600
    + utcInstant.getUTCMilliseconds() / 3_600_000;

  return wrapHours(apparentSolarHours - meanSolarHours) * 60;
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
    ? calculateEquationOfTimeMinutes(input, context.timezone.utcOffsetMinutes)
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
