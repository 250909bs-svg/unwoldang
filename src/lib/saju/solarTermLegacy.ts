/**
 * @deprecated Compact approximation retained only for audit comparisons.
 * Production calculation must use solarTerms.ts and must never silently fall
 * back to this implementation.
 */

const J2000 = 2451545.0;
const toJulianDay = (date: Date): number => date.getTime() / 86_400_000 + 2440587.5;

const normalizeAngle = (angle: number): number => angle - Math.floor(angle / 360) * 360;

const getLegacySolarLongitude = (julianDay: number): number => {
  const centuries = (julianDay - J2000) / 36525;
  const meanLongitude = 280.46646 + 36000.76983 * centuries + 0.0003032 * centuries * centuries;
  const meanAnomaly = 357.52911 + 35999.05029 * centuries - 0.0001537 * centuries * centuries;
  const meanAnomalyRad = meanAnomaly * Math.PI / 180;
  const equationOfCenter =
    (1.914602 - centuries * (0.004817 + 0.000014 * centuries)) * Math.sin(meanAnomalyRad) +
    (0.019993 - 0.000101 * centuries) * Math.sin(2 * meanAnomalyRad) +
    0.000289 * Math.sin(3 * meanAnomalyRad);
  const trueLongitude = meanLongitude + equationOfCenter;
  const omega = (125.04 - 1934.136 * centuries) * Math.PI / 180;

  return normalizeAngle(trueLongitude - 0.00569 - 0.00478 * Math.sin(omega));
};

const solveLegacySolarTermJulianDay = (year: number, targetLongitude: number): number => {
  const yearStart = toJulianDay(new Date(Date.UTC(year, 0, 1)));
  let julianDay = yearStart
    + (targetLongitude - getLegacySolarLongitude(yearStart)) * 365.25 / 360;

  for (let iteration = 0; iteration < 5; iteration += 1) {
    const longitude = getLegacySolarLongitude(julianDay);
    const difference = targetLongitude - longitude;
    const wrappedDifference = difference < -180
      ? difference + 360
      : difference > 180
        ? difference - 360
        : difference;
    julianDay += wrappedDifference / 0.9856;
  }

  return julianDay;
};

export const getLegacySolarTermInstantForGregorianYear = (
  year: number,
  targetLongitude: number,
): Date => {
  if (!Number.isInteger(year) || year < 1900 || year > 2099) {
    throw new Error(`지원하지 않는 절기 계산 연도입니다: ${year}`);
  }
  if (!Number.isFinite(targetLongitude) || targetLongitude < 0 || targetLongitude >= 360) {
    throw new Error(`유효하지 않은 태양 황경입니다: ${targetLongitude}`);
  }

  const calculationYear = targetLongitude < 280 ? year + 1 : year;
  const julianDay = solveLegacySolarTermJulianDay(calculationYear, targetLongitude);
  return new Date((julianDay - 2440587.5) * 86_400_000);
};
