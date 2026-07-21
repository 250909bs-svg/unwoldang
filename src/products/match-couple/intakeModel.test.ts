import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createEmptyMatchCoupleIntake,
  getMatchCoupleRelationshipSummary,
  hydrateMatchCoupleIntake,
  matchCoupleBirthLocations,
  serializeMatchCoupleIntake,
  validateMatchCoupleIntake
} from './intakeModel';
import type { MatchCoupleIntakeState, MatchCoupleStoredFormData } from './types';

const intakeSource = readFileSync(new URL('./Intake.tsx', import.meta.url), 'utf8');

function makeValidIntake(): MatchCoupleIntakeState {
  const state = createEmptyMatchCoupleIntake();

  return {
    self: {
      ...state.self,
      name: '본인 별칭',
      gender: 'female',
      calendar: 'solar',
      birthDate: '1992-09-09',
      birthTime: '10:24',
      isUnknownTime: false,
      isUnknownLocation: false,
      birthLocation: matchCoupleBirthLocations[0]
    },
    partner: {
      ...state.partner,
      name: '상대 별칭',
      gender: 'male',
      calendar: 'solar',
      birthDate: '1989-04-12',
      birthTime: '',
      isUnknownTime: true,
      isUnknownLocation: true,
      birthLocation: undefined
    },
    context: {
      ...state.context,
      relationshipStatus: 'dating',
      relationshipDuration: 'under3',
      majorConflict: '연락 주기와 약속을 정하는 방식이 다릅니다.',
      desiredInsight: '갈등 뒤에 회복하는 규칙을 알고 싶습니다.',
      questions: ['대화 방식을 어떻게 맞추면 좋을까요?', '오래 가기 위해 먼저 합의할 것은 무엇인가요?']
    }
  };
}

describe('match-couple intake model', () => {
  it('creates independent blank people and exactly two blank questions', () => {
    const state = createEmptyMatchCoupleIntake();

    expect(state.self).not.toBe(state.partner);
    expect(state.self.name).toBe('');
    expect(state.partner.name).toBe('');
    expect(state.context.questions).toEqual(['', '']);
    expect(state.self.birthLocation).toBeUndefined();
    expect(state.partner.birthLocation).toBeUndefined();
    expect(state.context.questions).toHaveLength(2);
  });

  it('assigns validation errors to the four owning steps', () => {
    const result = validateMatchCoupleIntake(createEmptyMatchCoupleIntake());

    expect(result.valid).toBe(false);
    expect(result.stepErrors[1].join(' ')).toContain('본인');
    expect(result.stepErrors[2].join(' ')).toContain('상대방');
    expect(result.stepErrors[1]).toContain('본인의 출생지역을 선택하거나 지역 미상을 체크해 주세요.');
    expect(result.stepErrors[2]).toContain('상대방의 출생지역을 선택하거나 지역 미상을 체크해 주세요.');
    expect(result.stepErrors[3]).toEqual([
      '현재 관계 상태를 선택해 주세요.',
      '관계 기간을 선택해 주세요.',
      '두 사람의 주요 갈등을 적어 주세요.',
      '이번 궁합에서 알고 싶은 점을 적어 주세요.'
    ]);
    expect(result.stepErrors[4]).toEqual([
      '첫 번째 질문을 입력해 주세요.',
      '두 번째 질문을 입력해 주세요.'
    ]);
  });

  it('accepts exact self time plus unknown partner time and location', () => {
    const result = validateMatchCoupleIntake(makeValidIntake());

    expect(result).toEqual({
      valid: true,
      stepErrors: { 1: [], 2: [], 3: [], 4: [] }
    });
  });

  it('uses an uncorrected server clock for unknown time but preserves the requested place policy', () => {
    const state = makeValidIntake();
    state.partner.isUnknownLocation = false;
    state.partner.birthLocation = matchCoupleBirthLocations[0];

    const serialized = serializeMatchCoupleIntake(state);

    expect(serialized.partner?.birthLocation).toMatchObject({
      label: '서울',
      applySolarTimeCorrection: false
    });
    expect(serialized.matchCoupleContext.partnerSolarTimeCorrectionRequested).toBe(true);
    expect(hydrateMatchCoupleIntake(serialized).partner.birthLocation).toMatchObject({
      label: '서울',
      applySolarTimeCorrection: true
    });
  });


  it('serializes both people, relationship context, and two contextualized questions', () => {
    const state = makeValidIntake();
    state.self.name = '  본인 별칭  ';
    state.self.isLeapMonth = true;
    state.partner.name = '  상대 별칭  ';
    state.context.relationshipDuration = 'over10';
    state.context.majorConflict = '  소비 기준이 다릅니다.  ';
    state.context.desiredInsight = '  장기 역할을 알고 싶습니다.  ';

    const serialized = serializeMatchCoupleIntake(state);

    expect(serialized.name).toBe('본인 별칭');
    expect(serialized.isLeapMonth).toBe(false);
    expect(serialized.partner).toMatchObject({
      name: '상대 별칭',
      birthTime: '',
      isUnknownTime: true,
      birthTimePrecision: 'unknown',
      birthLocation: undefined
    });
    expect(serialized.relationshipDuration).toBe('under10');
    expect(serialized.matchCoupleContext).toMatchObject({
      relationshipDuration: 'over10',
      majorConflict: '소비 기준이 다릅니다.',
      desiredInsight: '장기 역할을 알고 싶습니다.',
      selfLocationUnknown: false,
      partnerLocationUnknown: true
    });
    expect(serialized.matchCoupleContext.questions).toHaveLength(2);
    expect(serialized.q1).toContain('[궁합 관계 맥락] 연애 중 · 10년 이상');
    expect(serialized.q1).toContain('[주요 갈등] 소비 기준이 다릅니다.');
    expect(serialized.q1).toContain('[질문 1] 대화 방식을 어떻게 맞추면 좋을까요?');
    expect(serialized.q2).toContain('[질문 2] 오래 가기 위해 먼저 합의할 것은 무엇인가요?');
  });

  it('round-trips the product context and unknown flags through stored form data', () => {
    const serialized = serializeMatchCoupleIntake(makeValidIntake());
    const hydrated = hydrateMatchCoupleIntake(serialized);

    expect(hydrated.self.name).toBe('본인 별칭');
    expect(hydrated.self.birthTime).toBe('10:24');
    expect(hydrated.partner.name).toBe('상대 별칭');
    expect(hydrated.partner.isUnknownTime).toBe(true);
    expect(hydrated.partner.isUnknownLocation).toBe(true);
    expect(hydrated.partner.birthLocation).toBeUndefined();
    expect(hydrated.context).toEqual(serialized.matchCoupleContext);
  });

  it('does not treat legacy form data without the versioned context as a complete draft', () => {
    const legacy = {
      ...serializeMatchCoupleIntake(makeValidIntake()),
      matchCoupleContext: undefined
    } as unknown as Partial<MatchCoupleStoredFormData>;

    const hydrated = hydrateMatchCoupleIntake(legacy);

    expect(hydrated.self.name).toBe('');
    expect(hydrated.partner.name).toBe('');
    expect(hydrated.context.questions).toEqual(['', '']);
  });

  it('labels the stored relationship without converting the product-only duration', () => {
    const state = makeValidIntake();
    state.context.relationshipStatus = 'married';
    state.context.relationshipDuration = 'over10';

    expect(getMatchCoupleRelationshipSummary(state.context)).toBe('기혼·동거 중 · 10년 이상');
  });
});

describe('match-couple dedicated intake wiring', () => {
  it('keeps the four required stages in order', () => {
    const labels = [
      '먼저 본인의 출생 정보를 알려주세요',
      '상대방의 출생 정보도 입력해 주세요',
      '지금 두 사람의 관계를 설명해 주세요',
      '꼭 알고 싶은 질문 두 가지를 적어주세요'
    ];
    const positions = labels.map((label) => intakeSource.indexOf(label));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((left, right) => left - right)).toEqual(positions);
    expect(intakeSource).toContain("{([0, 1] as const).map((index) => (");
  });

  it('redirects through login, scopes drafts to the user, and preserves both submit paths', () => {
    expect(intakeSource).toContain("navigate('/login'");
    expect(intakeSource).toContain('returnTo: matchCoupleProduct.routes.intake');
    expect(intakeSource).toContain('DRAFT_PREFIX');
    expect(intakeSource).toContain('encodeURIComponent(userId.trim())');
    expect(intakeSource).toContain('serializeMatchCoupleIntake(intake)');
    expect(intakeSource).toContain('locationState?.recoveredEntitlement');
    expect(intakeSource).toContain('navigate(matchCoupleProduct.routes.loading');
    expect(intakeSource).toContain('navigate(matchCoupleProduct.routes.checkout');
    expect(intakeSource).toContain('draftOwnerId: user?.id');
  });
});
