import type { IntakeFormData, ServiceId } from '../../api/mockData';
import type { KasiCalendarVerification } from '../server/kasiCalendarService';
import { findServiceById } from '../../api/mockData';
import type { DayunData, Bazi, GZ } from './types';
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
import { DZ, ELEM_ORDER, HIDDEN_STEMS, TG, type FiveElement } from './constants';
import {
  buildBirthCalculation,
  type BirthCalculationResult,
  type BirthContextOptions
} from './v2/calendar';
import {
  analyzeExpertInterpretation,
  INTERPRETATION_ENGINE_VERSION
} from './v2/interpretation';
import { analyzeTemporalInteractions } from './v2/interactions';
import { analyzeCompatibility, type RelationshipPurpose } from './v2/compatibility';

export const COMMERCIAL_MYEONGRI_ENGINE_VERSION = 'unwoldang-myeongri-v2.0.0-rc.1' as const;

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

interface ZonedClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function getZonedClock(date = new Date(), timeZone = 'Asia/Seoul'): ZonedClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value || 0);

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute')
  };
}

function calendarOptionsFor(input: Partial<IntakeFormData>): BirthContextOptions {
  const location = input.birthLocation;
  const offset = location?.utcOffsetMinutes ?? (location?.timezone === 'Asia/Seoul' ? 540 : undefined);

  return {
    timezoneId: location?.timezone || 'Asia/Seoul',
    utcOffsetMinutes: offset,
    latitude: location?.latitude,
    longitude: location?.longitude,
    locationLabel: location?.label || input.location,
    applyTrueSolarTime: Boolean(
      location?.applySolarTimeCorrection && location.longitude !== undefined
    ),
    includeEquationOfTime: true,
    dayBoundaryPolicy: input.dayBoundaryPolicy === 'late-zi'
      ? 'late-zi-next-day'
      : 'civil-midnight'
  };
}

function baziCoreSignature(bazi: Bazi) {
  return [bazi.y_gz, bazi.m_gz, bazi.d_gz]
    .map((gz) => `${gz.tg}:${gz.dz}`)
    .join('|');
}

function pillarSignature(gz: GZ) {
  return `${gz.tg}:${gz.dz}`;
}

function summarizeCalendarScenarios(calculation: BirthCalculationResult) {
  const scenarioPillars = calculation.scenarios.map(({ scenario, bazi, trace }) => ({
    scenarioId: scenario.id,
    label: scenario.label,
    year: `${TG[bazi.y_gz.tg]}${DZ[bazi.y_gz.dz]}`,
    month: `${TG[bazi.m_gz.tg]}${DZ[bazi.m_gz.dz]}`,
    day: `${TG[bazi.d_gz.tg]}${DZ[bazi.d_gz.dz]}`,
    hour: bazi.h_gz ? `${TG[bazi.h_gz.tg]}${DZ[bazi.h_gz.dz]}` : null,
    apparentSolarDateTime: trace.solarTimeCorrection.apparentSolarDateTime,
    effectivePillarDate: trace.dayBoundary.effectivePillarDate
  }));
  const unique = (values: string[]) => [...new Set(values)];
  const yearVariants = unique(calculation.scenarios.map(({ bazi }) => pillarSignature(bazi.y_gz)));
  const monthVariants = unique(calculation.scenarios.map(({ bazi }) => pillarSignature(bazi.m_gz)));
  const dayVariants = unique(calculation.scenarios.map(({ bazi }) => pillarSignature(bazi.d_gz)));

  return {
    scenarioPillars,
    invariantPillars: {
      year: yearVariants.length <= 1,
      month: monthVariants.length <= 1,
      day: dayVariants.length <= 1
    },
    variantCounts: {
      year: yearVariants.length,
      month: monthVariants.length,
      day: dayVariants.length
    }
  };
}

function chooseStableBazi(calculation: BirthCalculationResult): {
  bazi: Bazi | null;
  selection: 'primary' | 'range-midpoint' | 'stable-without-hour' | 'unstable-day';
} {
  if (calculation.primary) {
    const primaryCore = baziCoreSignature(calculation.primary.bazi);
    const hasStableCore = calculation.scenarios.every(
      ({ bazi }) => baziCoreSignature(bazi) === primaryCore
    );
    if (!hasStableCore) {
      return { bazi: null, selection: 'unstable-day' };
    }
    return {
      bazi: calculation.primary.bazi,
      selection: calculation.context.time.precision === 'legacy-range'
        ? 'range-midpoint'
        : 'primary'
    };
  }

  const first = calculation.scenarios[0]?.bazi;
  if (!first) return { bazi: null, selection: 'unstable-day' };
  const invariantCore = calculation.scenarios.every(
    ({ bazi }) => baziCoreSignature(bazi) === baziCoreSignature(first)
  );

  return invariantCore
    ? { bazi: { ...first, h_gz: null }, selection: 'stable-without-hour' }
    : { bazi: null, selection: 'unstable-day' };
}

export function selectCurrentDayun(rows: DayunData[], referenceYear: number) {
  let index = -1;
  for (let candidate = rows.length - 1; candidate >= 0; candidate -= 1) {
    if (rows[candidate].year <= referenceYear) {
      index = candidate;
      break;
    }
  }

  if (index < 0) {
    return {
      phase: 'pre-dayun' as const,
      currentIndex: null,
      current: null,
      next: rows[0] || null
    };
  }

  return {
    phase: 'active' as const,
    currentIndex: index,
    current: rows[index] || null,
    next: rows[index + 1] || null
  };
}

function parseGanzhi(value: string): GZ | null {
  const [stem, branch, ...rest] = Array.from(value.trim());
  if (!stem || !branch || rest.length > 0) return null;
  const tg = TG.indexOf(stem as (typeof TG)[number]);
  const dz = DZ.indexOf(branch as (typeof DZ)[number]);
  if (tg < 0 || dz < 0 || tg % 2 !== dz % 2) return null;
  return { tg, dz };
}

function compatibilityPurpose(serviceId: ServiceId): RelationshipPurpose {
  return serviceId === 'match-destiny' ? 'marriage' : 'dating';
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

  const legacyBazi = calcBazi(year, month, day, hour, minute, calendar, leap, gender, false);
  const birthCalculation = buildBirthCalculation(formData, calendarOptionsFor(formData));
  const calendarScenarios = summarizeCalendarScenarios(birthCalculation);
  const stableBirth = chooseStableBazi(birthCalculation);
  const bazi = stableBirth.bazi || legacyBazi;
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
  const [legacyHelpfulElements, legacyCautiousElements] = usefulElements(dayMasterElement, strengthLabel);
  const expertInterpretation = stableBirth.bazi ? analyzeExpertInterpretation(bazi) : null;
  const consensus = expertInterpretation?.consensus;
  const promoteExpertConsensus = Boolean(
    consensus &&
    consensus.status === 'supported' &&
    !consensus.value.unresolved &&
    consensus.confidence.score >= 0.55 &&
    consensus.value.primaryCandidates.length > 0 &&
    consensus.value.primaryCandidates.length <= 2
  );
  const expertCautiousElements = consensus?.value.ranking
    .filter((item) => item.netScore <= -0.12)
    .map((item) => item.element) || [];
  const helpfulElements: FiveElement[] = promoteExpertConsensus
    ? consensus?.value.primaryCandidates || legacyHelpfulElements
    : legacyHelpfulElements;
  const cautiousElements: FiveElement[] = promoteExpertConsensus && expertCautiousElements.length > 0
    ? ELEM_ORDER.filter((element) => expertCautiousElements.includes(element))
    : legacyCautiousElements;
  const gyeokguk = getGyeokguk(bazi);
  const dayun = dayunRows(bazi);
  const referenceClock = getZonedClock();
  const seun = seunRows(referenceClock.year, 12);
  const currentFlowBazi = calcBazi(
    referenceClock.year,
    referenceClock.month,
    referenceClock.day,
    referenceClock.hour,
    referenceClock.minute,
    'solar',
    'normal',
    gender,
    false
  );
  const dayunSelection = selectCurrentDayun(dayun, referenceClock.year);
  const dayunGz = dayunSelection.current ? parseGanzhi(dayunSelection.current.ganzhi) : null;
  const temporalAnalysis = stableBirth.bazi
    ? analyzeTemporalInteractions({
        natal: bazi,
        dayun: dayunSelection.current && dayunGz
          ? {
              gz: dayunGz,
              label: `${dayunSelection.current.ganzhi} 대운`,
              referenceYear: dayunSelection.current.year
            }
          : undefined,
        seun: {
          gz: currentFlowBazi.y_gz,
          label: `${TG[currentFlowBazi.y_gz.tg]}${DZ[currentFlowBazi.y_gz.dz]} 세운`,
          referenceYear: referenceClock.year
        },
        wolyun: {
          gz: currentFlowBazi.m_gz,
          label: `${TG[currentFlowBazi.m_gz.tg]}${DZ[currentFlowBazi.m_gz.dz]} 월운`,
          referenceYear: referenceClock.year
        }
      })
    : null;

  const partnerInput = formData.partner;
  const partnerFormData: Partial<IntakeFormData> | null = partnerInput?.birthDate
    ? { ...partnerInput }
    : null;
  const partnerCalculation = partnerFormData
    ? buildBirthCalculation(partnerFormData, calendarOptionsFor(partnerFormData))
    : null;
  const partnerCalendarScenarios = partnerCalculation
    ? summarizeCalendarScenarios(partnerCalculation)
    : null;
  const stablePartnerBirth = partnerCalculation ? chooseStableBazi(partnerCalculation) : null;
  const partnerBazi = stablePartnerBirth?.bazi || null;
  const partnerInterpretation = partnerBazi ? analyzeExpertInterpretation(partnerBazi) : null;
  const partnerDayun = partnerBazi ? dayunRows(partnerBazi) : [];
  const partnerDayunSelection = selectCurrentDayun(partnerDayun, referenceClock.year);
  const partnerDayunGz = partnerDayunSelection.current
    ? parseGanzhi(partnerDayunSelection.current.ganzhi)
    : null;
  const partnerCurrentFlow = partnerInput
    ? calcBazi(
        referenceClock.year,
        referenceClock.month,
        referenceClock.day,
        referenceClock.hour,
        referenceClock.minute,
        'solar',
        'normal',
        partnerInput.gender,
        false
      )
    : null;
  const partnerTemporalAnalysis = partnerBazi && partnerCurrentFlow
    ? analyzeTemporalInteractions({
        natal: partnerBazi,
        dayun: partnerDayunSelection.current && partnerDayunGz
          ? {
              gz: partnerDayunGz,
              label: `${partnerDayunSelection.current.ganzhi} 대운`,
              referenceYear: partnerDayunSelection.current.year
            }
          : undefined,
        seun: {
          gz: partnerCurrentFlow.y_gz,
          label: `${TG[partnerCurrentFlow.y_gz.tg]}${DZ[partnerCurrentFlow.y_gz.dz]} 세운`,
          referenceYear: referenceClock.year
        },
        wolyun: {
          gz: partnerCurrentFlow.m_gz,
          label: `${TG[partnerCurrentFlow.m_gz.tg]}${DZ[partnerCurrentFlow.m_gz.dz]} 월운`,
          referenceYear: referenceClock.year
        }
      })
    : null;
  const compatibilityAnalysis = stableBirth.bazi && partnerBazi
    ? analyzeCompatibility({
        personA: bazi,
        personB: partnerBazi,
        purpose: compatibilityPurpose(serviceId)
      })
    : null;
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
  const advancedUncertainty = [
    ...birthCalculation.warnings,
    ...(stableBirth.selection === 'unstable-day'
      ? ['출생시각 시나리오에 따라 일주가 달라져 단일 전문 용신·대세운·궁합 결론을 유보했습니다.']
      : []),
    ...(birthCalculation.context.time.precision === 'legacy-range'
      ? ['시간대 입력은 시작·중앙·종료점 민감도를 비교하며 정확한 분 단위 출생시각으로 간주하지 않습니다.']
      : []),
    ...(dayunSelection.phase === 'pre-dayun'
      ? ['첫 대운 진입 전 구간이므로 현재 대운 없이 원국·세운·월운만 분석했습니다.']
      : []),
    ...(expertInterpretation?.consensus.value.unresolved
      ? ['용신 학설 간 충돌 또는 근접 후보가 있어 합성 결과를 확정 용신으로 승격하지 않았습니다.']
      : []),
    ...(temporalAnalysis?.uncertainty || []),
    ...(partnerCalculation?.warnings || []),
    ...(stablePartnerBirth?.selection === 'unstable-day'
      ? ['상대방의 출생시각 시나리오에 따라 일주가 달라져 단일 궁합 결론을 유보했습니다.']
      : []),
    ...(compatibilityAnalysis?.uncertainty || [])
  ];
  const uncertainty = [...new Set(advancedUncertainty)];
  const interpretationEvidenceCount = expertInterpretation
    ? Object.values(expertInterpretation.foundations)
        .reduce((sum, result) => sum + result.evidence.length, 0) +
      expertInterpretation.yongsinOpinions.reduce((sum, opinion) => sum + opinion.evidence.length, 0) +
      expertInterpretation.consensus.evidence.length
    : 0;
  const temporalEvidenceCount = temporalAnalysis
    ? temporalAnalysis.relations.length + temporalAnalysis.tenGodActivations.length + temporalAnalysis.findings.length
    : 0;
  const compatibilityEvidenceCount = compatibilityAnalysis
    ? compatibilityAnalysis.crossRelations.length + compatibilityAnalysis.facts.length + compatibilityAnalysis.dimensions.length
    : 0;
  const confidenceValues = [
    expertInterpretation?.consensus.confidence.score,
    temporalAnalysis?.confidence,
    compatibilityAnalysis?.confidence
  ].filter((value): value is number => typeof value === 'number');
  const overallConfidence = confidenceValues.length > 0
    ? Number((confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length).toFixed(3))
    : null;

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
      birthTimePrecision: birthCalculation.context.time.precision,
      dayBoundaryPolicy: birthCalculation.context.dayBoundaryPolicy,
      birthLocation: birthCalculation.context.location,
      timezone: birthCalculation.context.timezone.id,
      timezoneContext: birthCalculation.context.timezone,
      partner: partnerInput
        ? {
            name: partnerInput.name,
            gender: partnerInput.gender,
            calendar: partnerInput.calendar,
            birthDate: partnerInput.birthDate,
            birthTime: partnerInput.isUnknownTime ? null : partnerInput.birthTime,
            isUnknownTime: partnerInput.isUnknownTime,
            birthLocation: partnerCalculation?.context.location || null
          }
        : null,
      questions: [formData.q1, formData.q2]
        .filter((question): question is string => Boolean(question?.trim()))
        .map((question) => question.trim())
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
    legacyHelpfulElements,
    legacyCautiousElements,
    helpfulElementSource: promoteExpertConsensus
      ? ('expert-consensus' as const)
      : ('legacy-fallback' as const),
    gyeokguk,
    birthSummary: getBirthSummary(bazi),
    calculationBasis: bazi.calculationBasis,
    calendarVerification,
    commercialV2: {
      engineVersion: COMMERCIAL_MYEONGRI_ENGINE_VERSION,
      validationStatus: '내부 규칙·회귀 검증 완료 / 외부 명리 전문가 감수 전' as const,
      generatedFor: {
        timezone: 'Asia/Seoul',
        ...referenceClock
      },
      calendar: {
        version: birthCalculation.version,
        precision: birthCalculation.context.time.precision,
        dayBoundaryPolicy: birthCalculation.context.dayBoundaryPolicy,
        primaryScenarioId: birthCalculation.primary?.scenario.id || null,
        stableSelection: stableBirth.selection,
        scenarioCount: birthCalculation.scenarios.length,
        scenarioPillars: calendarScenarios.scenarioPillars,
        invariantPillars: calendarScenarios.invariantPillars,
        variantCounts: calendarScenarios.variantCounts,
        trueSolarTime: {
          requested: birthCalculation.context.trueSolarTime.enabled,
          applied: birthCalculation.scenarios.some(
            ({ trace }) => trace.solarTimeCorrection.applied
          ),
          correctionMinutes: birthCalculation.trace
            ? Number(birthCalculation.trace.solarTimeCorrection.appliedCorrectionMinutes.toFixed(3))
            : null
        },
        trace: birthCalculation.trace,
        warnings: birthCalculation.warnings
      },
      interpretation: expertInterpretation
        ? {
            version: INTERPRETATION_ENGINE_VERSION,
            ...expertInterpretation
          }
        : null,
      temporal: temporalAnalysis,
      luckContext: {
        referenceClock,
        phase: dayunSelection.phase,
        currentDayunIndex: dayunSelection.currentIndex,
        currentDayun: dayunSelection.current,
        nextDayun: dayunSelection.next,
        currentSeun: {
          gz: currentFlowBazi.y_gz,
          ganzhi: `${TG[currentFlowBazi.y_gz.tg]}${DZ[currentFlowBazi.y_gz.dz]}`
        },
        currentWolyun: {
          gz: currentFlowBazi.m_gz,
          ganzhi: `${TG[currentFlowBazi.m_gz.tg]}${DZ[currentFlowBazi.m_gz.dz]}`
        }
      },
      partner: partnerCalculation
        ? {
            name: partnerInput?.name || '',
            calendar: {
              version: partnerCalculation.version,
              precision: partnerCalculation.context.time.precision,
              dayBoundaryPolicy: partnerCalculation.context.dayBoundaryPolicy,
              primaryScenarioId: partnerCalculation.primary?.scenario.id || null,
              stableSelection: stablePartnerBirth?.selection || 'unstable-day',
              scenarioCount: partnerCalculation.scenarios.length,
              scenarioPillars: partnerCalendarScenarios?.scenarioPillars || [],
              invariantPillars: partnerCalendarScenarios?.invariantPillars || {
                year: false,
                month: false,
                day: false
              },
              warnings: partnerCalculation.warnings
            },
            interpretation: partnerInterpretation
              ? { version: INTERPRETATION_ENGINE_VERSION, ...partnerInterpretation }
              : null,
            temporal: partnerTemporalAnalysis,
            luckContext: {
              phase: partnerDayunSelection.phase,
              currentDayunIndex: partnerDayunSelection.currentIndex,
              currentDayun: partnerDayunSelection.current,
              nextDayun: partnerDayunSelection.next
            }
          }
        : null,
      compatibility: compatibilityAnalysis,
      evidenceSummary: {
        interpretation: interpretationEvidenceCount,
        temporal: temporalEvidenceCount,
        compatibility: compatibilityEvidenceCount,
        total: interpretationEvidenceCount + temporalEvidenceCount + compatibilityEvidenceCount
      },
      confidence: overallConfidence,
      uncertainty
    },
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
