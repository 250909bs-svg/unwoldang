import type { BirthLocationData, IntakeFormData, PartnerBirthData } from '../../api/mockData';
import {
  BRANCH_ELEM,
  DZ,
  ELEM_ORDER,
  TEN_GOD_LABELS,
  TG,
} from '../../lib/saju/constants';
import {
  fiveElementDistribution,
  getDayMasterElement,
  tenGodDistribution,
  tenGodFromBranch
} from '../../lib/saju/baziCalcs';
import type { Bazi, GZ } from '../../lib/saju/types';
import {
  buildBirthCalculation,
  CALENDAR_ENGINE_VERSION,
  type BirthCalculationResult,
  type BirthContextOptions
} from '../../lib/saju/v2/calendar';
import {
  analyzeCompatibility,
  type CompatibilityAnalysisResult,
  type CompatibilityDimension as EngineCompatibilityDimension,
  type CompatibilityTendency
} from '../../lib/saju/v2/compatibility';
import type { RelationEvidence, RelationKind } from '../../lib/saju/v2/interactions';
import { getMatchCoupleRelationshipSummary } from './intakeModel';
import type {
  MatchCoupleContext,
  MatchCoupleDimension,
  MatchCoupleGuidanceItem,
  MatchCouplePersonFacts,
  MatchCoupleRelationGroup,
  MatchCoupleRelationGroupId,
  MatchCoupleReportModel,
  MatchCoupleStoredFormData,
  MatchCoupleThirtyDayExperiment
} from './types';

const REPORT_VERSION = 'match-couple-report-v1' as const;

const RELATION_GROUPS: ReadonlyArray<{
  id: MatchCoupleRelationGroupId;
  label: MatchCoupleRelationGroup['label'];
  kinds: readonly RelationKind[];
}> = [
  {
    id: 'combine',
    label: '합',
    kinds: ['stem-combination', 'six-combination', 'three-harmony', 'seasonal-harmony']
  },
  { id: 'clash', label: '충', kinds: ['stem-clash', 'clash'] },
  { id: 'punishment', label: '형', kinds: ['punishment'] },
  { id: 'break', label: '파', kinds: ['break'] },
  { id: 'harm', label: '해', kinds: ['harm'] }
];

interface StableChartResolution {
  calculation: BirthCalculationResult | null;
  bazi: Bazi | null;
  exactTime: boolean;
  limitations: string[];
}

interface PersonBuildResult extends StableChartResolution {
  facts: MatchCouplePersonFacts | null;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function gzSignature(gz: GZ) {
  return `${gz.tg}:${gz.dz}`;
}

function pillarLabel(gz: GZ) {
  return `${TG[gz.tg]}${DZ[gz.dz]}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '알 수 없는 계산 오류가 발생했습니다.';
}

function localizePersonLabels(value: string, names: [string, string]) {
  return value
    .split('personA').join(names[0])
    .split('personB').join(names[1]);
}

function calendarOptions(
  location: BirthLocationData | undefined,
  dayBoundaryPolicy: IntakeFormData['dayBoundaryPolicy'] | PartnerBirthData['dayBoundaryPolicy']
): BirthContextOptions {
  return {
    timezoneId: location?.timezone || 'Asia/Seoul',
    utcOffsetMinutes: location?.utcOffsetMinutes,
    latitude: location?.latitude,
    longitude: location?.longitude,
    locationLabel: location?.label,
    applyTrueSolarTime: Boolean(
      location?.applySolarTimeCorrection && location.longitude !== undefined
    ),
    includeEquationOfTime: true,
    dayBoundaryPolicy: dayBoundaryPolicy === 'late-zi'
      ? 'late-zi-next-day'
      : 'civil-midnight'
  };
}

function invariantPillar(
  calculation: BirthCalculationResult,
  read: (bazi: Bazi) => GZ
) {
  const first = calculation.scenarios[0]?.bazi;
  if (!first) return false;
  const expected = gzSignature(read(first));
  return calculation.scenarios.every(({ bazi }) => gzSignature(read(bazi)) === expected);
}

function resolveStableChart(calculation: BirthCalculationResult): StableChartResolution {
  const limitations = [...calculation.warnings];
  const first = calculation.scenarios[0]?.bazi;
  if (!first) {
    return {
      calculation,
      bazi: null,
      exactTime: false,
      limitations: [...limitations, '출생시각 계산 시나리오가 없어 원국을 확정하지 못했습니다.']
    };
  }

  const invariant = {
    year: invariantPillar(calculation, (bazi) => bazi.y_gz),
    month: invariantPillar(calculation, (bazi) => bazi.m_gz),
    day: invariantPillar(calculation, (bazi) => bazi.d_gz)
  };
  const varying = [
    invariant.year ? '' : '연주',
    invariant.month ? '' : '월주',
    invariant.day ? '' : '일주'
  ].filter(Boolean);

  if (varying.length > 0) {
    return {
      calculation,
      bazi: null,
      exactTime: false,
      limitations: [
        ...limitations,
        `출생시각 시나리오에 따라 ${varying.join('·')}가 달라 단일 원국 결론을 유보했습니다.`
      ]
    };
  }

  const exactTime = calculation.context.time.precision === 'exact-minute';
  const selected = calculation.primary?.bazi || first;
  const stableBazi: Bazi = {
    ...selected,
    y_gz: { ...first.y_gz },
    m_gz: { ...first.m_gz },
    d_gz: { ...first.d_gz },
    h_gz: exactTime && selected.h_gz ? { ...selected.h_gz } : null
  };

  if (!exactTime) {
    limitations.push(
      '출생시각이 범위 또는 미상이므로 시주와 시주가 참여하는 오행·십신·교차 관계를 제외했습니다.'
    );
  }

  return {
    calculation,
    bazi: stableBazi,
    exactTime,
    limitations
  };
}

function getLocationLimitation(
  source: Partial<IntakeFormData> | PartnerBirthData,
  locationUnknown: boolean
) {
  const location = source.birthLocation;
  if (locationUnknown || !location) {
    return '출생지역 미상으로 진태양시 보정을 적용하지 않았습니다.';
  }
  if (
    typeof location.latitude !== 'number' ||
    typeof location.longitude !== 'number'
  ) {
    return `${location.label}의 좌표 또는 보정 기준이 없어 진태양시 보정을 적용하지 않았습니다.`;
  }
  if (source.isUnknownTime && location.applySolarTimeCorrection === false) {
    return '출생시간 미상으로 입력 지역의 진태양시 보정을 적용하지 않았습니다.';
  }
  if (location.applySolarTimeCorrection === false) {
    return `${location.label}의 진태양시 보정 설정이 비활성화되어 보정을 적용하지 않았습니다.`;
  }
  return null;
}

function buildPersonFacts(
  id: 'self' | 'partner',
  name: string,
  resolution: StableChartResolution,
  locationLimitation: string | null
): MatchCouplePersonFacts | null {
  const bazi = resolution.bazi;
  if (!bazi) return null;

  const dayMaster = TG[bazi.d_gz.tg];
  const dayMasterElement = getDayMasterElement(bazi.d_gz.tg);
  const branch = DZ[bazi.d_gz.dz];
  const elementDistribution = fiveElementDistribution(
    bazi.y_gz,
    bazi.m_gz,
    bazi.d_gz,
    bazi.h_gz
  );
  const godDistribution = tenGodDistribution(bazi);
  const availabilityNotes = [
    resolution.exactTime ? '' : '출생시각 의존 항목은 제외했습니다.',
    locationLimitation || ''
  ].filter(Boolean);

  return {
    id,
    name: name.trim() || (id === 'self' ? '본인' : '상대방'),
    dayMaster,
    dayMasterElement,
    pillars: {
      year: pillarLabel(bazi.y_gz),
      month: pillarLabel(bazi.m_gz),
      day: pillarLabel(bazi.d_gz),
      hour: bazi.h_gz ? pillarLabel(bazi.h_gz) : null
    },
    fiveElements: ELEM_ORDER.map((label) => ({
      label,
      weight: elementDistribution[label]
    })),
    tenGods: TEN_GOD_LABELS.map((label) => ({
      label,
      weight: godDistribution[label]
    })),
    spousePalace: {
      branch,
      element: BRANCH_ELEM[branch],
      tenGod: tenGodFromBranch(bazi.d_gz.tg, bazi.d_gz.dz)
    },
    availability: availabilityNotes.length > 0
      ? { status: 'limited', note: availabilityNotes.join(' ') }
      : { status: 'available' }
  };
}

function personCalculationInput(
  source: Partial<IntakeFormData> | PartnerBirthData,
  locationUnknown: boolean
): Partial<IntakeFormData> {
  return {
    name: source.name || '',
    gender: source.gender === 'male' ? 'male' : 'female',
    calendar: source.calendar === 'lunar' ? 'lunar' : 'solar',
    isLeapMonth: Boolean(source.isLeapMonth),
    birthDate: source.birthDate || '',
    birthTime: source.isUnknownTime ? '' : source.birthTime || '',
    isUnknownTime: Boolean(source.isUnknownTime),
    birthTimePrecision: source.birthTimePrecision,
    dayBoundaryPolicy: source.dayBoundaryPolicy,
    birthLocation: locationUnknown ? undefined : source.birthLocation,
    location: locationUnknown ? '' : source.birthLocation?.label || '',
    relationshipStatus: '',
    relationshipDuration: '',
    q1: '',
    q2: ''
  };
}
function restoreSolarTimeCorrection(

  source: Partial<IntakeFormData> | PartnerBirthData,
  requested: boolean
) {
  if (!source.birthLocation || !requested) return source;
  return {
    ...source,
    birthLocation: { ...source.birthLocation, applySolarTimeCorrection: true }
  };
}

function calculatePerson(
  id: 'self' | 'partner',
  source: Partial<IntakeFormData> | PartnerBirthData,
  locationUnknown: boolean
): PersonBuildResult {
  const input = personCalculationInput(source, locationUnknown);
  const location = locationUnknown ? undefined : source.birthLocation;

  try {
    const calculation = buildBirthCalculation(
      input,
      calendarOptions(location, source.dayBoundaryPolicy)
    );
    const resolution = resolveStableChart(calculation);
    const locationLimitation = getLocationLimitation(source, locationUnknown);
    const locationLimitations = locationLimitation ? [locationLimitation] : [];
    const withLocation = {
      ...resolution,
      limitations: [...resolution.limitations, ...locationLimitations]
    };
    return {
      ...withLocation,
      facts: buildPersonFacts(id, source.name || '', withLocation, locationLimitation)
    };
  } catch (error) {
    return {
      calculation: null,
      bazi: null,
      exactTime: false,
      facts: null,
      limitations: [`${id === 'self' ? '본인' : '상대방'} 원국 계산을 완료하지 못했습니다: ${errorMessage(error)}`]
    };
  }
}

export function groupMatchCoupleRelations(relations: RelationEvidence[], names?: [string, string]): MatchCoupleRelationGroup[] {
  return RELATION_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    items: relations
      .filter((relation) => group.kinds.includes(relation.relation))
      .map((relation) => ({
        id: relation.id,
        name: relation.name,
        subtype: relation.subtype || relation.name,
        description: names ? localizePersonLabels(relation.description, names) : relation.description,
        evidenceIds: [relation.id],
        uncertainty: [...relation.uncertainty]
      }))
  }));
}

function toDimension(
  dimension: EngineCompatibilityDimension,
  names: [string, string]
): MatchCoupleDimension {
  return {
    id: dimension.id,
    label: dimension.label,
    tendency: dimension.tendency,
    statement: localizePersonLabels(dimension.statement, names),
    evidenceIds: [...dimension.evidenceIds],
    uncertainty: dimension.uncertainty.map((item) => localizePersonLabels(item, names))
  };
}

function findDimension(
  analysis: CompatibilityAnalysisResult,
  id: string,
  names: [string, string]
) {
  const dimension = analysis.dimensions.find((item) => item.id === id);
  if (!dimension) {
    throw new Error(`궁합 분석 차원 ${id}를 찾지 못했습니다.`);
  }
  return toDimension(dimension, names);
}

const GUIDANCE_RULES: Record<
  keyof NonNullable<MatchCoupleReportModel['guidance']>,
  string
> = {
  attraction: '첫인상보다 세 번의 약속에서 보이는 일관성과 경계 존중을 확인하세요.',
  emotionalExpression: '감정을 추측하지 말고 지금 감정, 원하는 반응, 가능한 행동을 한 문장씩 나누세요.',
  communication: '연락 빈도와 답장 지연 허용 범위를 평온할 때 먼저 합의하세요.',
  conflictRecovery: '갈등이 커지면 중단 신호와 대화 재개 시각을 함께 정하고 약속한 때 돌아오세요.',
  dailyLife: '수면, 혼자 있는 시간, 집안일의 최소 기준을 역할이 아니라 행동 단위로 나누세요.',
  money: '공동 지출 기준액, 각자 자유 지출, 큰돈 논의 시점을 숫자로 합의하세요.',
  longTermRoles: '한 사람이 돌봄과 결정을 전담하지 않도록 월 1회 역할표를 다시 조정하세요.'
};

function practicalRule(
  key: keyof NonNullable<MatchCoupleReportModel['guidance']>,
  tendency: CompatibilityTendency
) {
  const suffix: Record<CompatibilityTendency, string> = {
    supportive: ' 잘 되는 방식도 자동으로 유지되지 않으므로 반복 가능한 규칙으로 고정하세요.',
    conditional: ' 2주 동안 시험한 뒤 두 사람 모두 지킬 수 있는 수준으로 조정하세요.',
    tension: ' 말로만 합의하지 말고 중단 조건과 재개 절차를 짧게 기록하세요.',
    insufficient: ' 계산 근거가 부족하므로 실제 행동 기록을 우선 기준으로 삼으세요.'
  };
  return GUIDANCE_RULES[key] + suffix[tendency];
}

function guidanceItem(
  key: keyof NonNullable<MatchCoupleReportModel['guidance']>,
  dimension: MatchCoupleDimension
): MatchCoupleGuidanceItem {
  return {
    ...dimension,
    practicalRule: practicalRule(key, dimension.tendency)
  };
}

function tenGodWeight(person: MatchCouplePersonFacts, label: string) {
  return person.tenGods.find((item) => item.label === label)?.weight || 0;
}

function buildMoneyDimension(
  people: [MatchCouplePersonFacts, MatchCouplePersonFacts]
): MatchCoupleDimension {
  const [self, partner] = people;
  const selfJeongjae = tenGodWeight(self, '정재');
  const selfPyeonjae = tenGodWeight(self, '편재');
  const partnerJeongjae = tenGodWeight(partner, '정재');
  const partnerPyeonjae = tenGodWeight(partner, '편재');
  const uncertainty = [
    '재성 분포는 지장간을 포함한 원국 근거이며 실제 소비 습관, 소득, 부채 또는 재무 결과를 확정하지 않습니다.'
  ];
  if (self.availability.status !== 'available' || partner.availability.status !== 'available') {
    uncertainty.push('한 명 이상의 출생시각이 정확하지 않아 시주에 따른 재성 근거를 제외했습니다.');
  }

  return {
    id: 'couple-money-practice',
    label: '소비·재물 운영',
    tendency: 'conditional',
    statement:
      `${self.name}의 지장간 포함 재성 근거는 정재 ${selfJeongjae}개·편재 ${selfPyeonjae}개, ` +
      `${partner.name}은 정재 ${partnerJeongjae}개·편재 ${partnerPyeonjae}개입니다. ` +
      '이 개수는 소비 성향 점수가 아니므로 실제 지출 기록과 합의 방식을 함께 확인해야 합니다.',
    evidenceIds: ['person:self:ten-gods', 'person:partner:ten-gods'],
    uncertainty
  };
}

function buildGuidance(
  dating: CompatibilityAnalysisResult,
  marriage: CompatibilityAnalysisResult,
  people: [MatchCouplePersonFacts, MatchCouplePersonFacts],
  names: [string, string]
): NonNullable<MatchCoupleReportModel['guidance']> {
  const attraction = findDimension(dating, 'dating-attraction', names);
  const emotionalExpression = findDimension(dating, 'dating-emotional-flow', names);
  const communication = findDimension(dating, 'dating-communication', names);
  const conflictRecovery = findDimension(marriage, 'marriage-conflict-repair', names);
  const dailyLife = findDimension(marriage, 'marriage-daily-balance', names);
  const money = buildMoneyDimension(people);
  const longTermRoles = findDimension(marriage, 'marriage-long-term-coordination', names);

  return {
    attraction: guidanceItem('attraction', attraction),
    emotionalExpression: guidanceItem('emotionalExpression', emotionalExpression),
    communication: guidanceItem('communication', communication),
    conflictRecovery: guidanceItem('conflictRecovery', conflictRecovery),
    dailyLife: guidanceItem('dailyLife', dailyLife),
    money: guidanceItem('money', money),
    longTermRoles: guidanceItem('longTermRoles', longTermRoles)
  };
}

function buildOverview(
  analysis: CompatibilityAnalysisResult,
  names: [string, string]
): MatchCoupleDimension {
  return {
    id: 'couple-overview',
    label: '두 사람의 관계 경향',
    tendency: analysis.overview.tendency,
    statement: localizePersonLabels(analysis.overview.statement, names),
    evidenceIds: [...analysis.overview.evidenceIds],
    uncertainty: analysis.overview.uncertainty.map((item) => localizePersonLabels(item, names))
  };
}

function buildCautionWords(hasTension: boolean) {
  const words = [
    '“늘 그래”, “절대 안 변해”처럼 상대를 한 문장으로 고정하는 말',
    '상대가 말하지 않은 속마음을 사실처럼 단정하는 말',
    '비교, 비꼼, 공개된 자리에서 체면을 깎는 말'
  ];
  if (hasTension) {
    words.push('헤어짐이나 관계 중단을 대화를 통제하는 압박 수단으로 쓰는 말');
  }
  return words;
}

function buildCautionActions(hasTension: boolean) {
  const actions = [
    '연락이 늦다는 이유만으로 반복 전화하거나 답을 강요하는 행동',
    '공동 지출이나 약속을 상의 없이 결정하고 나중에 통보하는 행동',
    '현재 갈등과 무관한 과거 잘못을 한꺼번에 꺼내는 행동'
  ];
  if (hasTension) {
    actions.push('대화 중 잠수한 뒤 재개 시점을 알리지 않는 행동');
  }
  return actions;
}

function buildRelationshipRules() {
  return [
    '연락 빈도와 답장 지연 허용 범위를 평온할 때 합의한다.',
    '갈등 중에는 한 번에 한 주제만 다루고 인신공격이 나오면 대화를 멈춘다.',
    '멈춘 대화는 재개할 날짜와 시각을 정한 뒤 반드시 돌아온다.',
    '공동 지출 기준액과 각자 설명 없이 쓸 수 있는 범위를 정한다.',
    '매주 20분 동안 좋았던 점 하나, 불편했던 점 하나, 다음 주 요청 하나를 나눈다.'
  ];
}

function buildExperiment(context: MatchCoupleContext): MatchCoupleThirtyDayExperiment[] {
  const conflict = context.majorConflict.trim() || '반복되는 갈등';
  const desired = context.desiredInsight.trim() || '관계를 더 잘 운영하는 방법';
  return [
    {
      days: '1~7일',
      title: '판단 없이 관찰하기',
      action: `“${conflict}”가 나타난 장면의 시간, 말, 행동, 감정 강도를 각자 기록하세요.`,
      check: '추측이 아니라 두 사람 모두 확인할 수 있는 반복 장면이 세 개 이상 모였는지 확인합니다.'
    },
    {
      days: '8~14일',
      title: '연락·감정 언어 맞추기',
      action: '하루 한 번 지금 감정, 원하는 반응, 오늘 가능한 행동을 각각 한 문장으로 말하세요.',
      check: '상대의 의도를 대신 해석하지 않고 확인 질문을 했는지 표시합니다.'
    },
    {
      days: '15~21일',
      title: '생활·돈 규칙 시험하기',
      action: '집안일 또는 만남 준비 한 가지와 공동 지출 기준 한 가지를 정해 7일 동안 시험하세요.',
      check: '한 사람에게 준비, 비용, 결정이 몰리지 않았는지 함께 확인합니다.'
    },
    {
      days: '22~30일',
      title: '회복 절차와 다음 합의',
      action: `“${desired}”를 기준으로 유지할 규칙 하나, 바꿀 규칙 하나, 중단할 행동 하나를 합의하세요.`,
      check: '갈등 뒤 약속한 시각에 대화를 다시 열었는지와 두 사람 모두 동의한 규칙인지 확인합니다.'
    }
  ];
}

function assertEssentialInput(formData: Partial<MatchCoupleStoredFormData>) {
  if (!formData.birthDate?.trim()) {
    throw new Error('match-couple 분석에는 본인의 생년월일이 필요합니다.');
  }
  if (!formData.partner) {
    throw new Error('match-couple 분석에는 상대방 출생정보가 필요합니다.');
  }
  if (!formData.partner.birthDate?.trim()) {
    throw new Error('match-couple 분석에는 상대방의 생년월일이 필요합니다.');
  }
  if (!formData.matchCoupleContext) {
    throw new Error('match-couple 분석에는 관계 맥락과 질문 2개가 필요합니다.');
  }
}

export function buildMatchCoupleReportModel(
  formData: Partial<MatchCoupleStoredFormData>
): MatchCoupleReportModel {
  assertEssentialInput(formData);
  const partner = formData.partner as PartnerBirthData;
  const context = formData.matchCoupleContext as MatchCoupleContext;
  const selfSource = restoreSolarTimeCorrection(
    formData,
    Boolean(context.selfSolarTimeCorrectionRequested)
  );
  const partnerSource = restoreSolarTimeCorrection(
    partner,
    Boolean(context.partnerSolarTimeCorrectionRequested)
  );
  const names: [string, string] = [
    formData.name?.trim() || '본인',
    partner.name?.trim() || '상대방'
  ];
  const selfResult = calculatePerson(
    'self',
    selfSource,
    Boolean(context.selfLocationUnknown)
  );
  const partnerResult = calculatePerson(
    'partner',
    partnerSource,
    Boolean(context.partnerLocationUnknown)
  );
  const limitations = [
    ...selfResult.limitations.map((item) => `${names[0]}: ${item}`),
    ...partnerResult.limitations.map((item) => `${names[1]}: ${item}`)
  ];

  let dating: CompatibilityAnalysisResult | null = null;
  let marriage: CompatibilityAnalysisResult | null = null;
  if (selfResult.bazi && partnerResult.bazi) {
    try {
      dating = analyzeCompatibility({
        personA: selfResult.bazi,
        personB: partnerResult.bazi,
        purpose: 'dating'
      });
      marriage = analyzeCompatibility({
        personA: selfResult.bazi,
        personB: partnerResult.bazi,
        purpose: 'marriage'
      });
    } catch (error) {
      limitations.push(`두 사람 궁합 계산을 완료하지 못했습니다: ${errorMessage(error)}`);
    }
  } else {
    limitations.push(
      '두 사람 중 한 명 이상의 연·월·일주가 시나리오별로 달라 전체 궁합 결론을 유보했습니다.'
    );
  }

  const people: MatchCoupleReportModel['people'] = [selfResult.facts, partnerResult.facts];
  const completePeople = selfResult.facts && partnerResult.facts
    ? [selfResult.facts, partnerResult.facts] as [MatchCouplePersonFacts, MatchCouplePersonFacts]
    : null;
  const primary = context.relationshipStatus === 'married' ? marriage : dating;
  const relations = groupMatchCoupleRelations(dating?.crossRelations || marriage?.crossRelations || [], names);
  const guidance = dating && marriage && completePeople
    ? buildGuidance(dating, marriage, completePeople, names)
    : null;
  const overview = primary ? buildOverview(primary, names) : null;
  const allDimensions = guidance ? Object.values(guidance) : [];
  const hasTension = Boolean(
    overview?.tendency === 'tension' ||
    allDimensions.some((dimension) => dimension.tendency === 'tension') ||
    relations.some((group) => group.id !== 'combine' && group.items.length > 0)
  );

  if (dating) {
    limitations.push(...dating.uncertainty.map((item) => localizePersonLabels(item, names)));
  }
  if (marriage) {
    limitations.push(...marriage.uncertainty.map((item) => localizePersonLabels(item, names)));
  }
  limitations.push(
    '궁합 경향은 관계의 성공·실패 확률이나 상대방의 속마음을 뜻하지 않습니다.',
    '30일 관계 실험은 행동을 확인하기 위한 계획이며 길일·흉일 예측이 아닙니다.'
  );

  const evidenceIds = unique([
    ...(selfResult.facts ? ['person:self:day-master', 'person:self:five-elements', 'person:self:ten-gods', 'person:self:spouse-palace'] : []),
    ...(partnerResult.facts ? ['person:partner:day-master', 'person:partner:five-elements', 'person:partner:ten-gods', 'person:partner:spouse-palace'] : []),
    ...(overview?.evidenceIds || []),
    ...relations.flatMap((group) => group.items.flatMap((item) => item.evidenceIds)),
    ...allDimensions.flatMap((dimension) => dimension.evidenceIds)
  ]);
  const questions: [string, string] = [
    context.questions?.[0] || '',
    context.questions?.[1] || ''
  ];
  const reportContext: MatchCoupleContext = {
    ...context,
    questions
  };

  return {
    version: REPORT_VERSION,
    names,
    relationshipSummary: getMatchCoupleRelationshipSummary(reportContext),
    context: reportContext,
    people,
    overview,
    relations,
    guidance,
    cautionWords: buildCautionWords(hasTension),
    cautionActions: buildCautionActions(hasTension),
    relationshipRules: buildRelationshipRules(),
    experiment: buildExperiment(reportContext),
    questions,
    limitations: unique(limitations),
    evidenceIds,
    generatedFrom: {
      calendarEngine: CALENDAR_ENGINE_VERSION,
      compatibilityEngine: dating && marriage ? dating.engineVersion : null
    }
  };
}
