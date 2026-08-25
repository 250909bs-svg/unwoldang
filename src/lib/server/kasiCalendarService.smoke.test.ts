import { describe, expect, it } from 'vitest';
import type { IntakeFormData } from '../../api/mockData';
import { buildBirthCalculation } from '../saju/v2/calendar';
import { getSolarTermInstantForGregorianYear } from '../saju/sxtwl';
import { normalizeFormDataWithKasi, type KasiCalendarVerification } from './kasiCalendarService';

const lunarSmokeEnabled = process.env.KASI_LUNAR_SMOKE_TEST === '1';
const specialDaySmokeEnabled = process.env.KASI_SPECIALDAY_SMOKE_TEST === '1';

const base: IntakeFormData = {
  name: 'KASI연동검증', gender: 'female', calendar: 'solar', isLeapMonth: false,
  birthDate: '1992-09-09', birthTime: '09:36', isUnknownTime: false,
  birthTimePrecision: 'exact', dayBoundaryPolicy: 'midnight',
  birthLocation: {
    label: '서울특별시', timezone: 'Asia/Seoul', utcOffsetMinutes: 540,
    latitude: 37.5665, longitude: 126.978, applySolarTimeCorrection: false
  },
  timezone: 'Asia/Seoul', utcOffsetMinutes: 540, latitude: 37.5665, longitude: 126.978,
  applySolarTimeCorrection: false, relationshipStatus: 'single', relationshipDuration: '',
  location: '서울특별시', q1: '올해 우선순위는 무엇인가요?', q2: '현재 재물 흐름은 어떤가요?'
};

function expectVerified(verification: KasiCalendarVerification) {
  expect(verification.status, verification.message).toBe('verified');
  expect(verification.enabled).toBe(true);
}

function expectGanji(value: string | undefined, korean: string, hanja: string) {
  expect(value).toBeTruthy();
  expect(value?.includes(korean) || value?.includes(hanja)).toBe(true);
}

function intakeAtKstInstant(instant: Date, minuteDelta: number): IntakeFormData {
  const kst = new Date(instant.getTime() + minuteDelta * 60_000 + 9 * 60 * 60_000);
  const birthDate = [
    kst.getUTCFullYear(),
    String(kst.getUTCMonth() + 1).padStart(2, '0'),
    String(kst.getUTCDate()).padStart(2, '0')
  ].join('-');
  const birthTime = `${String(kst.getUTCHours()).padStart(2, '0')}:${String(kst.getUTCMinutes()).padStart(2, '0')}`;
  return { ...base, birthDate, birthTime };
}

async function verifyLunar(input: IntakeFormData) {
  const result = await normalizeFormDataWithKasi(input);
  expectVerified(result.verification);
  expect(result.verification.lunarCalendarVerification.status).toBe('verified');
  const calculation = buildBirthCalculation(result.formData);
  expect(calculation.primary).not.toBeNull();
  return { ...result, calculation };
}

async function verifySpecialDay(input: IntakeFormData) {
  const result = await normalizeFormDataWithKasi(input);
  expect(result.verification.solarTermVerification.status).toBe('verified');
  const calculation = buildBirthCalculation(result.formData);
  expect(calculation.primary).not.toBeNull();
  return { ...result, calculation };
}

describe.runIf(lunarSmokeEnabled)('KASI lunar-calendar live API smoke', () => {
  it('cross-checks 1992-09-09 solar and its year/month/day ganzhi metadata', async () => {
    const result = await verifyLunar(base);
    expect(result.verification.lunar).toMatchObject({
      year: '1992', month: '08', day: '13', leapMonth: '평'
    });
    expectGanji(result.verification.lunar?.yearGanji, '임신', '壬申');
    expectGanji(result.verification.lunar?.monthGanji, '기유', '己酉');
    expectGanji(result.verification.lunar?.dayGanji, '무자', '戊子');
  });

  it('normalizes a flat lunar date to the expected solar date', async () => {
    const result = await verifyLunar({
      ...base, calendar: 'lunar', birthDate: '1992-08-13', isLeapMonth: false
    });
    expect(result.formData).toMatchObject({
      calendar: 'solar', birthDate: '1992-09-09', isLeapMonth: false
    });
    expect(result.verification.lunar?.leapMonth).toBe('평');
  });

  it('normalizes a valid leap-month date to the expected solar date', async () => {
    const result = await verifyLunar({
      ...base, calendar: 'lunar', birthDate: '2023-02-01', isLeapMonth: true
    });
    expect(result.formData).toMatchObject({
      calendar: 'solar', birthDate: '2023-03-22', isLeapMonth: false
    });
    expect(result.verification.lunar?.leapMonth).toBe('윤');
  });
});

describe.runIf(specialDaySmokeEnabled)('KASI special-day live API smoke', () => {
  it('checks KASI Ipchun date and the internal minute boundary immediately before and after it', async () => {
    const instant = getSolarTermInstantForGregorianYear(2024, 315);
    const before = await verifySpecialDay(intakeAtKstInstant(instant, -1));
    const after = await verifySpecialDay(intakeAtKstInstant(instant, 1));
    const termDate = intakeAtKstInstant(instant, 0).birthDate;

    expect(before.verification.solarTerms).toContainEqual({ name: '입춘', date: termDate });
    expect(after.verification.solarTerms).toContainEqual({ name: '입춘', date: termDate });
    expect(before.calculation.primary?.bazi.y_gz).not.toEqual(after.calculation.primary?.bazi.y_gz);
    expect(before.calculation.primary?.bazi.m_gz).not.toEqual(after.calculation.primary?.bazi.m_gz);
  });

  it('checks KASI Gyeongchip date and the internal monthly term boundary', async () => {
    const instant = getSolarTermInstantForGregorianYear(2024, 345);
    const before = await verifySpecialDay(intakeAtKstInstant(instant, -1));
    const after = await verifySpecialDay(intakeAtKstInstant(instant, 1));
    const termDate = intakeAtKstInstant(instant, 0).birthDate;

    expect(before.verification.solarTerms).toContainEqual({ name: '경칩', date: termDate });
    expect(after.verification.solarTerms).toContainEqual({ name: '경칩', date: termDate });
    expect(before.calculation.primary?.bazi.y_gz).toEqual(after.calculation.primary?.bazi.y_gz);
    expect(before.calculation.primary?.bazi.m_gz).not.toEqual(after.calculation.primary?.bazi.m_gz);
  });
});
