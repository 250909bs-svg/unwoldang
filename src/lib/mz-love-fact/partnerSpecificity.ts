import type { LoveInterest } from '../../api/mockData';
import type { EarthlyBranch } from '../saju/constants';
import type { FiveElement, SajuReportData } from '../saju/report';
import { buildPartnerAppearanceProfile } from './partnerAppearance';
import type { MzLoveSceneKey } from './types';

export type PartnerHeightBand = 'balanced' | 'long-proportion' | 'tall';

export type PartnerProfessionCandidate = {
  id: string;
  rank: 1 | 2 | 3;
  label: string;
  relatedRoles: string;
  fieldLabel: string;
  score: number;
  evidence: readonly string[];
};

export type PartnerSpecificityProfile = {
  version: 'partner-specificity-v2';
  signatureKey: string;
  height: {
    band: PartnerHeightBand;
    representativeCm: number;
    rangeCm: readonly [number, number];
    label: string;
    kind: 'symbolic-visual-reference';
    numericReference: boolean;
  };
  face: {
    primary: string;
    secondary: string;
    label: string;
  };
  professions: readonly [
    PartnerProfessionCandidate,
    PartnerProfessionCandidate,
    PartnerProfessionCandidate
  ];
  meeting: {
    primaryContext: string;
    primaryLocation: string;
    scene: string;
    sceneKey: MzLoveSceneKey;
    recognitionSignal: string;
    recognitionSignalKind: 'practical-check';
    evidence: readonly string[];
  };
  evidenceSummary: string;
  disclosure: string;
};

type ProfessionDefinition = {
  id: string;
  label: string;
  relatedRoles: string;
  fieldLabel: string;
  tenGods: readonly string[];
  elements: readonly FiveElement[];
};

const HEIGHT_BAND_BY_BRANCH: Record<EarthlyBranch, PartnerHeightBand> = {
  자: 'balanced',
  축: 'balanced',
  인: 'tall',
  묘: 'long-proportion',
  진: 'tall',
  사: 'balanced',
  오: 'tall',
  미: 'balanced',
  신: 'long-proportion',
  유: 'balanced',
  술: 'balanced',
  해: 'long-proportion'
};

const HEIGHT_REFERENCE = {
  masculine: { balanced: 174, 'long-proportion': 177, tall: 180 },
  feminine: { balanced: 162, 'long-proportion': 165, tall: 168 },
  neutral: { balanced: 168, 'long-proportion': 171, tall: 174 }
} as const;

const HEIGHT_BAND_LABEL: Record<PartnerHeightBand, string> = {
  balanced: '균형형',
  'long-proportion': '긴 비율형',
  tall: '장신형'
};

const PROFESSION_DEFINITIONS: readonly ProfessionDefinition[] = [
  { id: 'tax-accountant', label: '세무사', relatedRoles: '회계사·재무관리', fieldLabel: '세무·회계 전문직', tenGods: ['정재', '편재', '정관'], elements: ['토', '금'] },
  { id: 'lawyer', label: '변호사', relatedRoles: '노무사·법무·컴플라이언스', fieldLabel: '법률·규정 전문직', tenGods: ['정관', '편관', '정인'], elements: ['금', '토'] },
  { id: 'doctor', label: '의사', relatedRoles: '약사·임상전문직', fieldLabel: '의료·임상 전문직', tenGods: ['정인', '편인', '정관'], elements: ['수', '금', '화'] },
  { id: 'entertainer', label: '배우', relatedRoles: '방송인·크리에이터·콘텐츠 PD', fieldLabel: '연예·콘텐츠 직군', tenGods: ['상관', '식신', '편재'], elements: ['화', '목'] },
  { id: 'developer', label: '개발자', relatedRoles: '데이터 분석가·AI 엔지니어', fieldLabel: '기술·데이터 전문직', tenGods: ['편인', '상관', '정인'], elements: ['수', '금'] },
  { id: 'educator', label: '교사', relatedRoles: '교수·상담가·연구원', fieldLabel: '교육·연구 전문직', tenGods: ['정인', '편인', '식신'], elements: ['목', '수'] },
  { id: 'public-sector', label: '공무원', relatedRoles: '공기업·감사·행정 기획', fieldLabel: '공공·행정 직군', tenGods: ['정관', '정재', '편관'], elements: ['토', '금'] },
  { id: 'architect', label: '건축사', relatedRoles: '부동산·공간 기획', fieldLabel: '건축·부동산 전문직', tenGods: ['정재', '편재', '식신'], elements: ['토', '목'] },
  { id: 'business', label: '사업가', relatedRoles: '영업·무역·파트너십', fieldLabel: '사업·영업 직군', tenGods: ['편재', '겁재', '비견'], elements: ['화', '수'] },
  { id: 'brand', label: '브랜드 기획자', relatedRoles: '디자이너·마케터', fieldLabel: '브랜드·디자인 직군', tenGods: ['상관', '식신', '편재'], elements: ['화', '목'] }
];

const MEETING_BY_ELEMENT: Record<FiveElement, Omit<PartnerSpecificityProfile['meeting'], 'recognitionSignal' | 'recognitionSignalKind' | 'evidence'>> = {
  목: {
    primaryContext: '배움이 반복되는 자리',
    primaryLocation: '소규모 자격증 강의실',
    scene: '같은 강의실에서 자료를 주고받다가 쉬는 시간에 두 번째 대화가 이어지는 장면',
    sceneKey: 'hobby-meeting-studio'
  },
  화: {
    primaryContext: '사람과 취향이 모이는 자리',
    primaryLocation: '전시·팝업 행사장',
    scene: '같은 전시물을 보고 먼저 감상을 나눈 뒤 연락처를 주고받는 장면',
    sceneKey: 'friend-introduction-door'
  },
  토: {
    primaryContext: '생활 동선이 겹치는 자리',
    primaryLocation: '직장 근처 단골 카페',
    scene: '같은 시간대에 반복해서 마주치다가 주문이나 자리를 계기로 첫 대화가 시작되는 장면',
    sceneKey: 'first-meeting-scene'
  },
  금: {
    primaryContext: '전문성과 일이 연결되는 자리',
    primaryLocation: '프로젝트 계약 미팅',
    scene: '업무 질문이나 자료 확인으로 대화를 시작하고 상대가 다음 일정을 먼저 구체화하는 장면',
    sceneKey: 'work-connection-table'
  },
  수: {
    primaryContext: '정보와 이동이 이어지는 자리',
    primaryLocation: '온라인 커뮤니티의 오프라인 모임',
    scene: '온라인에서 주고받던 정보가 소규모 오프라인 약속으로 이어지는 장면',
    sceneKey: 'first-meeting-scene'
  }
};

function fnv1a(source: string) {
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rankProfessions(
  report: SajuReportData,
  spouseElement: FiveElement
): PartnerSpecificityProfile['professions'] {
  const dominantTenGods = [...(report.tenGods || [])]
    .map((item, index) => ({ ...item, index }))
    .sort((left, right) => right.value - left.value || left.index - right.index)
    .slice(0, 3);
  const helpfulElements = (report.helpfulElements || []).slice(0, 2);

  const ranked = PROFESSION_DEFINITIONS.map((definition) => {
    const evidence: string[] = [];
    let score = 0;

    dominantTenGods.forEach((tenGod, index) => {
      if (definition.tenGods.includes(tenGod.label)) {
        score += [12, 8, 4][index] || 0;
        evidence.push(`상위 십성 ${tenGod.label}`);
      }
    });
    helpfulElements.forEach((element, index) => {
      if (definition.elements.includes(element)) {
        score += index === 0 ? 5 : 3;
        evidence.push(`도움 오행 ${element}`);
      }
    });
    if (definition.elements.includes(spouseElement)) {
      score += 3;
      evidence.push(`배우자궁 ${spouseElement}`);
    }
    if (definition.elements.includes(report.dayMasterElement)) {
      score += 1;
      evidence.push(`일간 ${report.dayMasterElement}`);
    }
    if (!evidence.length) evidence.push(`일간 ${report.dayMasterElement}의 보조 결`);
    return { definition, score, evidence };
  })
    .sort((left, right) => right.score - left.score || left.definition.id.localeCompare(right.definition.id, 'ko'))
    .slice(0, 3);

  const [first, second, third] = ranked;
  if (!first || !second || !third) {
    throw new Error('직업 대표군을 세 가지 이상 구성하지 못했습니다.');
  }

  const makeCandidate = (
    item: (typeof ranked)[number],
    rank: 1 | 2 | 3
  ): PartnerProfessionCandidate => ({
    id: item.definition.id,
    rank,
    label: item.definition.label,
    relatedRoles: item.definition.relatedRoles,
    fieldLabel: item.definition.fieldLabel,
    score: item.score,
    evidence: item.evidence
  });

  return [makeCandidate(first, 1), makeCandidate(second, 2), makeCandidate(third, 3)];
}

function getHeightPresentation(interestedIn?: LoveInterest) {
  if (interestedIn === 'men') return 'masculine';
  if (interestedIn === 'women') return 'feminine';
  return 'neutral';
}

export const PARTNER_SPECIFICITY_DISCLOSURE =
  '키 숫자·직업명·만남 장면은 배우자궁과 십성·오행을 시각화한 대표 범위와 1순위 사례입니다. 실제 미래 인물의 신상이나 직업, 만남 장소를 확정하는 예언이 아닙니다.';

export function buildPartnerSpecificityProfile(
  report: SajuReportData,
  interestedIn?: LoveInterest
): PartnerSpecificityProfile {
  const appearance = buildPartnerAppearanceProfile(report);
  const spouseBranch = appearance.spousePalace.branch;
  const spouseElement = appearance.spousePalace.element;
  const band = HEIGHT_BAND_BY_BRANCH[spouseBranch];
  const presentation = getHeightPresentation(interestedIn);
  const numericReference = presentation !== 'neutral';
  const representativeCm = HEIGHT_REFERENCE[presentation][band];
  const rangeCm = [representativeCm - 2, representativeCm + 2] as const;
  const professions = rankProfessions(report, spouseElement);
  const meetingElement = report.helpfulElements?.[0] || spouseElement;
  const meetingSeed = MEETING_BY_ELEMENT[meetingElement];
  const topTenGod = [...(report.tenGods || [])]
    .sort((left, right) => right.value - left.value)[0]?.label || '십성 균형';
  const evidenceSummary = `배우자궁 ${appearance.spousePalace.pillar}(${spouseElement}) · 상위 십성 ${topTenGod} · 도움 오행 ${meetingElement}`;
  const signatureSource = [
    'partner-specificity-v2',
    appearance.signatureKey,
    presentation,
    professions.map((item) => item.id).join(','),
    meetingElement
  ].join('|');

  return {
    version: 'partner-specificity-v2',
    signatureKey: `ps2-${fnv1a(signatureSource).toString(36).padStart(7, '0')}`,
    height: {
      band,
      representativeCm,
      rangeCm,
      label: numericReference
        ? `${representativeCm}cm 전후 · ${rangeCm[0]}~${rangeCm[1]}cm ${HEIGHT_BAND_LABEL[band]} 인연상`
        : `성별 비한정 · ${HEIGHT_BAND_LABEL[band]} 비율이 두드러지는 상징 인연상`,
      kind: 'symbolic-visual-reference',
      numericReference
    },
    face: {
      primary: appearance.primaryArchetype.label,
      secondary: appearance.secondaryArchetype.label,
      label: `${appearance.primaryArchetype.label} 1순위 + ${appearance.secondaryArchetype.label} 보조`
    },
    professions,
    meeting: {
      ...meetingSeed,
      recognitionSignal: `현실 확인 기준(명리 판정과 별도): 첫 만남 뒤 1~2주 안에 두 번째 일정이 구체적으로 잡히는지 보세요. 특히 ${professions[0].fieldLabel}처럼 약속과 책임을 다루는 말투가 단서입니다.`,
      recognitionSignalKind: 'practical-check',
      evidence: [
        `도움 오행 ${meetingElement}`,
        `배우자궁 ${spouseBranch}(${spouseElement})`,
        `직업 이미지 1순위 ${professions[0].label}`
      ]
    },
    evidenceSummary,
    disclosure: PARTNER_SPECIFICITY_DISCLOSURE
  };
}
