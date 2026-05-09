import type { IntakeFormData, ServiceId } from '../../api/mockData';
import type { KasiCalendarVerification } from '../server/kasiCalendarService';
import { findServiceById } from '../../api/mockData';
import {
  calcBazi,
  daymasterStrength,
  dayunRows,
  describeDayBranch,
  describeDayMaster,
  detectShensha,
  fiveElementDistribution,
  getBirthSummary,
  getDayMasterElement,
  getDominantTenGod,
  getGyeokguk,
  getPillarLabels,
  getTwelveYunseong,
  getZodiacAnimal,
  seunRows,
  summarizeStrength,
  tenGodDistribution,
  usefulElements
} from './baziCalcs';
import { DZ, TG } from './constants';

function normalizeBirthDate(value?: string) {
  if (!value) {
    throw new Error('생년월일이 없습니다.');
  }

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!year || !month || !day) {
    throw new Error('생년월일 형식이 올바르지 않습니다.');
  }

  return { year, month, day };
}

function normalizeBirthTime(formData: Partial<IntakeFormData>) {
  if (formData.isUnknownTime || !formData.birthTime) {
    return { hour: null, minute: null };
  }

  const timeText = formData.birthTime.trim();
  const timeMatch = timeText.match(/(\d{1,2}):(\d{2})/);

  if (!timeMatch) {
    return { hour: null, minute: null };
  }

  const [, hourText, minuteText] = timeMatch;
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { hour: null, minute: null };
  }

  return { hour, minute };
}

function mapFiveElements(distribution: Record<string, number>) {
  return Object.entries(distribution).map(([label, value]) => ({ label, value }));
}

function mapTenGods(distribution: Record<string, number>) {
  return Object.entries(distribution)
    .sort((left, right) => right[1] - left[1])
    .map(([label, value]) => ({ label, value }));
}

export type DeterministicSajuBasis = ReturnType<typeof buildDeterministicSajuBasis>;

export function buildDeterministicSajuBasis(
  serviceId: ServiceId,
  formData: Partial<IntakeFormData>,
  calendarVerification?: KasiCalendarVerification
) {
  const service = findServiceById(serviceId);
  const { year, month, day } = normalizeBirthDate(formData.birthDate);
  const { hour, minute } = normalizeBirthTime(formData);
  const gender = formData.gender === 'male' ? 'male' : 'female';
  const calendar = formData.calendar === 'lunar' ? 'lunar' : 'solar';
  const leap = formData.isLeapMonth ? 'leap' : 'normal';

  const bazi = calcBazi(year, month, day, hour, minute, calendar, leap, gender, false);
  const pillarLabels = getPillarLabels(bazi);
  const zodiac = getZodiacAnimal(bazi.y_gz);
  const dayMaster = TG[bazi.d_gz.tg];
  const dayBranch = DZ[bazi.d_gz.dz];
  const dayMasterElement = getDayMasterElement(bazi.d_gz.tg);
  const dayMasterInfo = describeDayMaster(dayMaster);
  const dayBranchInfo = describeDayBranch(dayBranch);
  const fiveElements = fiveElementDistribution(bazi.y_gz, bazi.m_gz, bazi.d_gz, bazi.h_gz);
  const tenGods = tenGodDistribution(bazi);
  const dominantTenGods = getDominantTenGod(tenGods);
  const [strengthRatio, strengthLabel, strengthReasons] = daymasterStrength(bazi);
  const [helpfulElements, cautiousElements] = usefulElements(dayMasterElement, strengthLabel);
  const gyeokguk = getGyeokguk(bazi);
  const dayun = dayunRows(bazi);
  const seun = seunRows(new Date().getFullYear(), 12);
  const shensha = detectShensha(
    [bazi.y_gz.dz, bazi.m_gz.dz, bazi.d_gz.dz, bazi.h_gz?.dz]
      .filter((value): value is number => value !== null && value !== undefined)
      .map((index) => DZ[index]),
    TG[bazi.d_gz.tg],
    DZ[bazi.d_gz.dz]
  );
  const yunseong = {
    year: getTwelveYunseong(bazi.d_gz.tg, bazi.y_gz.dz),
    month: getTwelveYunseong(bazi.d_gz.tg, bazi.m_gz.dz),
    day: getTwelveYunseong(bazi.d_gz.tg, bazi.d_gz.dz),
    hour: bazi.h_gz ? getTwelveYunseong(bazi.d_gz.tg, bazi.h_gz.dz) : null
  };

  return {
    service: {
      id: service.id,
      label: service.label,
      advisor: service.advisor
    },
    input: {
      name: formData.name || '',
      gender,
      calendar,
      isLeapMonth: Boolean(formData.isLeapMonth),
      birthDate: formData.birthDate || '',
      birthTime: formData.isUnknownTime ? null : formData.birthTime || null,
      isUnknownTime: Boolean(formData.isUnknownTime),
      timezone: 'Asia/Seoul',
      questions: [formData.q1, formData.q2].filter((question): question is string => Boolean(question?.trim()))
    },
    pillars: {
      year: pillarLabels.year,
      month: pillarLabels.month,
      day: pillarLabels.day,
      hour: pillarLabels.hour
    },
    zodiac,
    dayMaster: {
      stem: dayMaster,
      branch: dayBranch,
      element: dayMasterElement,
      description: dayMasterInfo.description,
      keywords: dayMasterInfo.keywords
    },
    dayBranch: {
      branch: dayBranch,
      description: dayBranchInfo.description,
      keywords: dayBranchInfo.keywords
    },
    strength: {
      ratio: Number(strengthRatio.toFixed(3)),
      label: strengthLabel,
      summary: summarizeStrength(dayMasterElement, strengthLabel, helpfulElements, cautiousElements),
      reasons: strengthReasons
    },
    helpfulElements,
    cautiousElements,
    gyeokguk,
    birthSummary: getBirthSummary(bazi),
    calculationBasis: bazi.calculationBasis,
    calendarVerification,
    fiveElements: mapFiveElements(fiveElements),
    tenGods: mapTenGods(tenGods),
    dominantTenGods,
    yunseong,
    shensha,
    dayun,
    seun
  };
}
