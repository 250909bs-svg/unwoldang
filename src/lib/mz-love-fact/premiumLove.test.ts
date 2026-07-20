import { describe, expect, it } from 'vitest';
import type { IntakeFormData } from '../../api/mockData';
import { buildSajuReport } from '../saju/reportBuilder';
import { buildPartnerAppearanceProfile } from './partnerAppearance';
import { mzLoveCustomerNarrativeOrFallback } from './viewModel';
import {
  getPartnerInterestLabel,
  getPartnerPortraits,
  getPortraitEvidenceLabel,
  getPremiumLoveAnswers,
  SYMBOLIC_PARTNER_DISCLOSURE
} from './premiumLove';

function makeLoveReport() {
  const formData: Partial<IntakeFormData> = {
    name: '서윤',
    gender: 'female',
    interestedIn: 'any',
    calendar: 'solar',
    isLeapMonth: false,
    birthDate: '1994-05-18',
    birthTime: '09:24',
    isUnknownTime: false,
    relationshipStatus: 'single',
    relationshipDuration: '',
    loveFocus: 'partner-type',
    location: '',
    q1: '어떤 사람과 오래 갈 수 있을까요?',
    q2: '다음 인연은 언제 만날 수 있을까요?'
  };

  return buildSajuReport('love-reading', formData);
}

const PORTRAIT_ASSET_BY_ARCHETYPE = {
  tofu: { suffix: 'soft', version: 'v2' },
  cat: { suffix: 'sleek', version: 'v2' },
  dog: { suffix: 'dog', version: 'v3' },
  dinosaur: { suffix: 'strong', version: 'v2' },
  deer: { suffix: 'deer', version: 'v3' },
  fox: { suffix: 'fox', version: 'v3' },
  'deep-contour': { suffix: 'deep', version: 'v2' }
} as const;

describe('premium love symbolic partner portraits', () => {
  it('남성 인연을 고르면 남성 상징 초상 하나만 반환한다', () => {
    const appearance = buildPartnerAppearanceProfile(makeLoveReport());
    const portraits = getPartnerPortraits('men', appearance);
    const archetype = appearance.primaryArchetype.id;
    const asset = PORTRAIT_ASSET_BY_ARCHETYPE[archetype];

    expect(portraits).toHaveLength(1);
    expect(portraits[0]).toMatchObject({
      id: `masculine-${archetype}`,
      presentation: 'masculine',
      imageFamily: appearance.imageFamily,
      appearanceArchetype: archetype,
      src: `/images/mz-love-fact/generated/future-partner-male-${asset.suffix}-${asset.version}.webp`,
      avifSrc: `/images/mz-love-fact/generated/future-partner-male-${asset.suffix}-${asset.version}.avif`,
      width: 941,
      height: 1672
    });
    expect(portraits[0].alt).toContain('성인 남성');
    expect(portraits[0].alt).toContain(appearance.primaryArchetype.label);
    expect(portraits[0].alt).toContain(appearance.secondaryArchetype.label);
    expect(getPartnerInterestLabel('men')).toBe('남성 인연');
  });

  it('여성 인연을 고르면 여성 상징 초상 하나만 반환한다', () => {
    const appearance = buildPartnerAppearanceProfile(makeLoveReport());
    const portraits = getPartnerPortraits('women', appearance);
    const archetype = appearance.primaryArchetype.id;
    const asset = PORTRAIT_ASSET_BY_ARCHETYPE[archetype];

    expect(portraits).toHaveLength(1);
    expect(portraits[0]).toMatchObject({
      id: `feminine-${archetype}`,
      presentation: 'feminine',
      imageFamily: appearance.imageFamily,
      appearanceArchetype: archetype,
      src: `/images/mz-love-fact/generated/future-partner-female-${asset.suffix}-${asset.version}.webp`,
      avifSrc: `/images/mz-love-fact/generated/future-partner-female-${asset.suffix}-${asset.version}.avif`,
      width: 941,
      height: 1672
    });
    expect(portraits[0].alt).toContain('성인 여성');
    expect(portraits[0].alt).toContain(appearance.primaryArchetype.label);
    expect(portraits[0].alt).toContain(appearance.secondaryArchetype.label);
    expect(getPartnerInterestLabel('women')).toBe('여성 인연');
  });

  it('any는 중복 없이 남성·여성 상징 초상을 모두 반환한다', () => {
    const appearance = buildPartnerAppearanceProfile(makeLoveReport());
    const portraits = getPartnerPortraits('any', appearance);

    expect(portraits.map((portrait) => portrait.presentation)).toEqual(['masculine', 'feminine']);
    expect(portraits.every((portrait) => portrait.imageFamily === appearance.imageFamily)).toBe(true);
    expect(portraits.every((portrait) => portrait.appearanceArchetype === appearance.primaryArchetype.id)).toBe(true);
    expect(new Set(portraits.map((portrait) => portrait.src)).size).toBe(2);
    expect(getPartnerInterestLabel('any')).toBe('성별을 한정하지 않은 인연');
    expect(SYMBOLIC_PARTNER_DISCLOSURE).toContain('창작 상징 초상');
    expect(SYMBOLIC_PARTNER_DISCLOSURE).toContain('실제 미래 인물의 얼굴');
  });
});

describe('premium love nine core answers', () => {
  it('고객이 궁금해하는 9개 핵심 답변을 고정 순서로 제공한다', () => {
    const report = makeLoveReport();
    const answers = getPremiumLoveAnswers(report);

    expect(answers).toHaveLength(9);
    expect(answers.map((answer) => answer.id)).toEqual([
      'who',
      'face',
      'timing',
      'meeting',
      'work',
      'contact',
      'marriage',
      'avoid',
      'action'
    ]);
    expect(new Set(answers.map((answer) => answer.id)).size).toBe(9);

    for (const answer of answers) {
      expect(answer.eyebrow.trim()).not.toBe('');
      expect(answer.question.trim()).not.toBe('');
      expect(answer.answer.trim()).not.toBe('');
    }
  });

  it('love 섹션 카드를 고객용 안전 문구 경계를 거쳐 핵심 답변에 연결한다', () => {
    const report = makeLoveReport();
    const answers = getPremiumLoveAnswers(report);
    const byId = new Map(answers.map((answer) => [answer.id, answer]));
    const loveSection = report.sections.find((section) => section.id === 'love');
    const cardBody = (title: string) => loveSection?.cards?.find((card) => card.title === title)?.body;

    const cardExpectations = [
      ['who', '실제로 오래 가는 사람', '말보다 약속과 생활 리듬으로 신뢰를 보여주는 사람이 오래 갑니다.'],
      ['meeting', '만남이 열리는 루트', '한 번 스치는 곳보다 대화와 약속이 반복되는 생활 반경에서 인연이 열립니다.'],
      ['work', '인연이 닿기 쉬운 직업군', '직업명보다 책임을 지는 방식과 일상을 운영하는 리듬을 먼저 확인해 보세요.'],
      ['contact', '연락 스타일', '답장 속도 하나보다 바쁜 날에도 관계의 맥락이 끊기지 않는지를 확인해야 합니다.'],
      ['marriage', '결혼 후 모습', '돈·시간·가족·휴식의 기준을 말로 합의할 수 있을 때 장기 관계가 안정됩니다.'],
      ['avoid', '피해야 할 사람', '관계를 정의하지 않으면서 필요할 때만 가까워지는 패턴은 초반부터 멈춰서 봐야 합니다.']
    ] as const;

    for (const [id, title, fallback] of cardExpectations) {
      expect(byId.get(id)?.answer).toBe(
        mzLoveCustomerNarrativeOrFallback(cardBody(title), fallback)
      );
    }

    expect(byId.get('face')?.answer).toBe(buildPartnerAppearanceProfile(report).headline);
  });

  it('시기 답변에 가장 점수가 높은 3개 월과 첫 행동 지침을 반영한다', () => {
    const report = makeLoveReport();
    const timing = getPremiumLoveAnswers(report).find((answer) => answer.id === 'timing');
    const strongest = [...report.monthLuck]
      .sort((left, right) => right.score - left.score)
      .slice(0, 3);

    expect(strongest).toHaveLength(3);
    for (const month of strongest) {
      expect(timing?.answer).toContain(`${month.year}년 ${month.month}월`);
    }
    const safeFocus = mzLoveCustomerNarrativeOrFallback(
      strongest[0]?.focus,
      '새로운 접점을 늘리고 두 번째 약속이 잡히는지 확인해 보세요.'
    );
    expect(timing?.answer).toContain(safeFocus);
  });

  it('즉시 행동과 초상 근거를 실제 리포트 데이터에서 구성하고 내부·사업 문구는 노출하지 않는다', () => {
    const report = makeLoveReport();
    const answers = getPremiumLoveAnswers(report);
    const action = answers.find((answer) => answer.id === 'action');
    const evidence = getPortraitEvidenceLabel(report);
    const actionFallback = '원하는 관계의 기준을 한 문장으로 적고, 새로운 반복 접점을 하나 늘려 보세요.';
    const expectedAction = mzLoveCustomerNarrativeOrFallback(
      report.actionPlan.priorities[0] || report.actionPlan.dos[0],
      actionFallback
    );
    const forbiddenCopy = /(?:고객|결제|가격|매출|수익|엔진|engine|audit|evidence|sourcePath|engineMeta|confidence|결정론|검증\s*로그|\d{1,3}\s*%)/iu;

    expect(action?.answer).toBe(expectedAction);
    for (const answer of answers) {
      expect(answer.answer).not.toMatch(forbiddenCopy);
    }
    expect(evidence).toContain(report.pillars.day);
    expect(evidence).toContain(report.currentDayun.name);
    for (const element of report.helpfulElements) {
      expect(evidence).toContain(element);
    }
  });
});
