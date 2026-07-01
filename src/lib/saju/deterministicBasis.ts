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
  tenGod,
  summarizeStrength,
  tenGodDistribution,
  usefulElements
} from './baziCalcs';
import { DZ, HIDDEN_STEMS, TG } from './constants';

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

const STEM_HANJA: Record<string, string> = {
  갑: '甲',
  을: '乙',
  병: '丙',
  정: '丁',
  무: '戊',
  기: '己',
  경: '庚',
  신: '辛',
  임: '壬',
  계: '癸'
};

const BRANCH_HANJA: Record<string, string> = {
  자: '子',
  축: '丑',
  인: '寅',
  묘: '卯',
  진: '辰',
  사: '巳',
  오: '午',
  미: '未',
  신: '申',
  유: '酉',
  술: '戌',
  해: '亥'
};

const PILLAR_ORDER = [
  ['년주', 'year', 'y_gz'],
  ['월주', 'month', 'm_gz'],
  ['일주', 'day', 'd_gz'],
  ['시주', 'hour', 'h_gz']
] as const;

function formatHanjaPillar(pillar: string | null) {
  if (!pillar) return null;
  const [stem, branch] = [...pillar];
  return `${STEM_HANJA[stem] || stem}${BRANCH_HANJA[branch] || branch}`;
}

function buildVisibleTenGods(bazi: ReturnType<typeof calcBazi>, pillarLabels: ReturnType<typeof getPillarLabels>) {
  return PILLAR_ORDER.flatMap(([label, key, baziKey]) => {
    const pillar = bazi[baziKey];
    const pillarLabel = pillarLabels[key];

    if (!pillar || !pillarLabel) {
      return [];
    }

    const stem = TG[pillar.tg];
    const branch = DZ[pillar.dz];
    const mainHiddenStem = HIDDEN_STEMS[branch]?.[HIDDEN_STEMS[branch].length - 1];
    const branchMainStem = mainHiddenStem === undefined ? '-' : TG[mainHiddenStem];
    const stemTenGod = tenGod(bazi.d_gz.tg, pillar.tg);
    const branchTenGod = mainHiddenStem === undefined ? '미상' : tenGod(bazi.d_gz.tg, mainHiddenStem);
    const stemHanja = STEM_HANJA[stem] || stem;
    const branchHanja = BRANCH_HANJA[branch] || branch;

    return [{
      pillar: label,
      stem,
      stemHanja,
      stemTenGod,
      branch,
      branchHanja,
      branchMainStem,
      branchTenGod,
      reading: `${stemHanja} ${stemTenGod} / ${branchHanja} ${branchTenGod}`,
      pillarHanja: formatHanjaPillar(pillarLabel)
    }];
  });
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
  const visibleTenGods = buildVisibleTenGods(bazi, pillarLabels);
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
    visibleTenGods,
    tenGodBasisNote:
      '겉글자 기준은 천간과 지지의 대표 기운을 분리해 본 값입니다. 십성 분포 점수는 지장간 포함 기준이므로 숫자와 겉글자 표기가 다르게 보일 수 있습니다.',
    dominantTenGods,
    yunseong,
    shensha,
    dayun,
    seun
  };
}
