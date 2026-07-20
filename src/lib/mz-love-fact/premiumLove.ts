import type { LoveInterest } from '../../api/mockData';
import type { SajuReportData } from '../saju/report';
import {
  buildPartnerAppearanceProfile,
  type PartnerAppearanceArchetypeId,
  type PartnerAppearanceImageFamily,
  type PartnerAppearanceProfile
} from './partnerAppearance';
import { buildPartnerSpecificityProfile } from './partnerSpecificity';
import { mzLoveCustomerNarrativeOrFallback } from './viewModel';

export type SymbolicPartnerPortrait = {
  id: string;
  presentation: 'masculine' | 'feminine';
  imageFamily?: PartnerAppearanceImageFamily;
  appearanceArchetype?: PartnerAppearanceArchetypeId;
  label: string;
  pronoun: string;
  src: string;
  avifSrc: string;
  alt: string;
  width: number;
  height: number;
};

export type PremiumLoveAnswer = {
  id: string;
  eyebrow: string;
  question: string;
  answer: string;
};

const FALLBACK_PARTNER_PORTRAITS: Record<'men' | 'women', SymbolicPartnerPortrait> = {
  men: {
    id: 'masculine',
    presentation: 'masculine',
    label: '남성 인연상',
    pronoun: '그 사람',
    src: '/images/mz-love-fact/generated/future-partner-male-v1.webp',
    avifSrc: '/images/mz-love-fact/generated/future-partner-male-v1.avif',
    alt: '명리 신호를 바탕으로 창작한 성인 남성 인연의 상징 초상',
    width: 941,
    height: 1672
  },
  women: {
    id: 'feminine',
    presentation: 'feminine',
    label: '여성 인연상',
    pronoun: '그 사람',
    src: '/images/mz-love-fact/generated/future-partner-female-v1.webp',
    avifSrc: '/images/mz-love-fact/generated/future-partner-female-v1.avif',
    alt: '명리 신호를 바탕으로 창작한 성인 여성 인연의 상징 초상',
    width: 941,
    height: 1672
  }
};

const ARCHETYPE_PORTRAIT_ASSETS: Record<
  PartnerAppearanceArchetypeId,
  { suffix: string; version: 'v2' | 'v3' }
> = {
  tofu: { suffix: 'soft', version: 'v2' },
  cat: { suffix: 'sleek', version: 'v2' },
  dog: { suffix: 'dog', version: 'v3' },
  dinosaur: { suffix: 'strong', version: 'v2' },
  deer: { suffix: 'deer', version: 'v3' },
  fox: { suffix: 'fox', version: 'v3' },
  'deep-contour': { suffix: 'deep', version: 'v2' }
};

function makePortrait(
  interest: 'men' | 'women',
  appearance: PartnerAppearanceProfile
): SymbolicPartnerPortrait {
  const presentation = interest === 'men' ? 'masculine' : 'feminine';
  const genderLabel = interest === 'men' ? '남성' : '여성';
  const fileGender = interest === 'men' ? 'male' : 'female';
  const archetype = appearance.primaryArchetype.id;
  const asset = ARCHETYPE_PORTRAIT_ASSETS[archetype];
  const imageLabel = `${appearance.primaryArchetype.label} + ${appearance.secondaryArchetype.label}`;

  return {
    id: `${presentation}-${archetype}`,
    presentation,
    imageFamily: appearance.imageFamily,
    appearanceArchetype: archetype,
    label: `${genderLabel} 인연상 · ${imageLabel}`,
    pronoun: '그 사람',
    src: `/images/mz-love-fact/generated/future-partner-${fileGender}-${asset.suffix}-${asset.version}.webp`,
    avifSrc: `/images/mz-love-fact/generated/future-partner-${fileGender}-${asset.suffix}-${asset.version}.avif`,
    alt: `사주 외모 프로필의 ${imageLabel} 특징을 시각화한 성인 ${genderLabel} 상징 초상`,
    width: 941,
    height: 1672
  };
}

export const SYMBOLIC_PARTNER_DISCLOSURE =
  '이 이미지는 일지 배우자궁·일간 오행·도움 오행·십성 분포에서 읽은 외모 분위기를 시각화한 창작 상징 초상입니다. 실제 미래 인물의 얼굴이나 정확한 키를 예측하지 않습니다.';

export function getPartnerPortraits(
  interestedIn?: LoveInterest,
  appearance?: PartnerAppearanceProfile
): readonly SymbolicPartnerPortrait[] {
  const portraitFor = (interest: 'men' | 'women') => appearance
    ? makePortrait(interest, appearance)
    : FALLBACK_PARTNER_PORTRAITS[interest];

  if (interestedIn === 'men') return [portraitFor('men')];
  if (interestedIn === 'women') return [portraitFor('women')];
  return [portraitFor('men'), portraitFor('women')];
}

export function getPartnerInterestLabel(interestedIn?: LoveInterest) {
  if (interestedIn === 'men') return '남성 인연';
  if (interestedIn === 'women') return '여성 인연';
  return '성별을 한정하지 않은 인연';
}

function loveCard(report: SajuReportData, title: string, fallback: string) {
  const section = (report.sections || []).find((item) => item.id === 'love');
  const candidate = section?.cards?.find((card) => card.title === title)?.body;
  return mzLoveCustomerNarrativeOrFallback(candidate, fallback);
}

function timingAnswer(report: SajuReportData) {
  const strongest = [...(report.monthLuck || [])]
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);

  if (!strongest.length) {
    const dayunName = report.currentDayun?.name || '현재 흐름';
    return `${dayunName}에서는 기다리는 것보다 반복 접점을 만드는 행동이 인연운을 현실로 바꿉니다.`;
  }

  const labels = strongest.map((item) => `${item.year}년 ${item.month}월`).join(' · ');
  const focus = mzLoveCustomerNarrativeOrFallback(
    strongest[0]?.focus,
    '새로운 접점을 늘리고 두 번째 약속이 잡히는지 확인해 보세요.',
  );
  return `절기 월운의 오행 흐름상 관계 행동을 먼저 늘려 볼 구간은 ${labels}입니다. ${focus} 이는 인연 성사를 보장하는 날짜가 아니라 우선 관찰 구간입니다.`;
}

export function getPremiumLoveAnswers(report: SajuReportData, interestedIn?: LoveInterest): readonly PremiumLoveAnswer[] {
  const appearance = buildPartnerAppearanceProfile(report);
  const specificity = buildPartnerSpecificityProfile(report, interestedIn);

  return [
    {
      id: 'who',
      eyebrow: 'WHO',
      question: '결국 어떤 사람과 오래 갈까?',
      answer: loveCard(report, '실제로 오래 가는 사람', '말보다 약속과 생활 리듬으로 신뢰를 보여주는 사람이 오래 갑니다.')
    },
    {
      id: 'face',
      eyebrow: 'FACE',
      question: '그 사람은 어떤 얼굴과 분위기일까?',
      answer: `${specificity.height.label}, ${specificity.face.label}로 읽힙니다. ${appearance.build}`
    },
    {
      id: 'timing',
      eyebrow: 'WHEN',
      question: '전체 월운에서 관계를 움직여 볼 시기는?',
      answer: timingAnswer(report)
    },
    {
      id: 'meeting',
      eyebrow: 'WHERE',
      question: '어디서 어떻게 만나게 될까?',
      answer: `1순위 장소는 ${specificity.meeting.primaryLocation}입니다. ${specificity.meeting.scene}. ${specificity.meeting.recognitionSignal}`
    },
    {
      id: 'work',
      eyebrow: 'LIFE',
      question: '그 사람의 일과 생활 결은 어떨까?',
      answer: `직업 이미지는 1순위 ${specificity.professions[0].label}, 2순위 ${specificity.professions[1].label}, 3순위 ${specificity.professions[2].label}입니다. 실제 직업 확정이 아니라 ${specificity.professions[0].evidence.join('·')}에서 읽은 대표 사례예요.`
    },
    {
      id: 'contact',
      eyebrow: 'CONTACT',
      question: '연락과 애정 표현은 잘 맞을까?',
      answer: loveCard(report, '연락 스타일', '답장 속도 하나보다 바쁜 날에도 관계의 맥락이 끊기지 않는지를 확인해야 합니다.')
    },
    {
      id: 'marriage',
      eyebrow: 'FUTURE',
      question: '연애가 결혼과 생활로 이어질 수 있을까?',
      answer: loveCard(report, '결혼 후 모습', '돈·시간·가족·휴식의 기준을 말로 합의할 수 있을 때 장기 관계가 안정됩니다.')
    },
    {
      id: 'avoid',
      eyebrow: 'WARNING',
      question: '이번에는 어떤 사람을 반드시 피해야 할까?',
      answer: loveCard(report, '피해야 할 사람', '관계를 정의하지 않으면서 필요할 때만 가까워지는 패턴은 초반부터 멈춰서 봐야 합니다.')
    },
    {
      id: 'action',
      eyebrow: 'NOW',
      question: '그럼 지금 내가 먼저 해야 할 일은?',
      answer: mzLoveCustomerNarrativeOrFallback(
        report.actionPlan?.priorities?.[0] || report.actionPlan?.dos?.[0],
        '원하는 관계의 기준을 한 문장으로 적고, 새로운 반복 접점을 하나 늘려 보세요.',
      )
    }
  ];
}

export function getPortraitEvidenceLabel(report: SajuReportData) {
  const dayPillar = report.pillars?.day || `${report.dayMaster || '나'} 일간`;
  const dayunName = report.currentDayun?.name || '현재 흐름';
  const helpfulElements = report.helpfulElements?.join('·') || '균형';
  return `${dayPillar} · ${dayunName} · 도움 기운 ${helpfulElements}`;
}
