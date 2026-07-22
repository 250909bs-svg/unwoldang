import { describe, expect, it } from 'vitest';
import type { PartnerBirthData } from '../../api/mockData';
import {
  LOVE_REUNION_CHECKOUT_INTENT_KEY,
  LOVE_REUNION_DRAFT_KEY,
  LOVE_REUNION_TEXT_LIMITS,
  createEmptyLoveReunionFormData,
  hydrateLoveReunionFormData,
  prepareLoveReunionCheckoutFormData,
  validateLoveReunionFormData,
  type LoveReunionFormData
} from './contract';

function makeValidLoveReunionFormData(): LoveReunionFormData {
  return {
    ...createEmptyLoveReunionFormData(),
    name: '테스트',
    birthDate: '1990-01-01',
    birthTime: '12:30',
    isUnknownTime: false,
    birthTimePrecision: 'exact',
    q1: '지금 연락을 시도하기 전에 확인할 조건은 무엇인가요?',
    q2: '재회하지 않는 편이 낫다면 어떤 신호를 봐야 하나요?',
    reunionContext: {
      version: 2,
      relationshipState: 'separated-no-contact',
      relationshipLength: '1-to-3-years',
      breakupElapsed: '1-to-3-months',
      lastContactTiming: 'under-1-month',
      lastContactNote: '',
      currentContact: 'none',
      contactBoundary: 'none',
      breakupReason: 'communication',
      breakupReasonDetail: '',
      reunionReason: '같은 갈등을 반복하지 않을 준비가 되었는지 확인하고 싶습니다.',
      partnerBirthKnown: false,
      partnerDataPermissionConfirmed: false
    }
  };
}

describe('love-reunion intake contract', () => {
  it('starts empty and reports every required birth, reunion-context, and question field', () => {
    const empty = createEmptyLoveReunionFormData();
    const result = validateLoveReunionFormData(empty);

    expect(empty.name).toBe('');
    expect(empty.birthDate).toBe('');
    expect(empty.partner).toBeUndefined();
    expect(empty.reunionContext).toEqual({
      version: 2,
      relationshipState: '',
      relationshipLength: '',
      breakupElapsed: '',
      lastContactTiming: '',
      lastContactNote: '',
      currentContact: '',
      contactBoundary: '',
      breakupReason: '',
      breakupReasonDetail: '',
      reunionReason: '',
      partnerBirthKnown: false,
      partnerDataPermissionConfirmed: false
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('본인의 이름'),
      '현재 관계 상태를 선택해 주세요.',
      '교제 기간을 선택해 주세요.',
      '이별 후 경과 기간을 선택해 주세요.',
      '마지막 연락 시점을 선택해 주세요.',
      '현재 연락 상태를 선택해 주세요.',
      '이별 이유를 선택해 주세요.',
      '재회를 바라는 이유를 입력해 주세요.',
      '첫 번째 질문을 입력해 주세요.',
      '연락 거절 또는 안전 경계 여부를 선택해 주세요.',
      '두 번째 질문을 입력해 주세요.'
    ]));
  });

  it('keeps a valid lunar leap-month self birth with unknown time', () => {
    const data = makeValidLoveReunionFormData();
    const result = validateLoveReunionFormData({
      ...data,
      calendar: 'lunar',
      isLeapMonth: true,
      birthDate: '2023-02-01',
      birthTime: '',
      isUnknownTime: true,
      birthTimePrecision: 'unknown'
    });

    expect(result.valid).toBe(true);
    expect(result.self.normalizedPrecision).toBe('unknown');
    expect(result.self.calculation?.context.calendar).toBe('lunar');
    expect(result.self.calculation?.context.isLeapMonth).toBe(true);
  });

  it('allows the partner birth to be completely unknown', () => {
    const data = makeValidLoveReunionFormData();
    const result = validateLoveReunionFormData(data);
    const prepared = prepareLoveReunionCheckoutFormData(data);

    expect(result.valid).toBe(true);
    expect(result.partner).toBeNull();
    expect(prepared.partner).toBeUndefined();
  });

  it('requires partner data permission and accepts a permitted partner with unknown time', () => {
    const partner: PartnerBirthData = {
      name: '상대방',
      gender: 'male',
      calendar: 'solar',
      isLeapMonth: false,
      birthDate: '1992-09-09',
      birthTime: '',
      isUnknownTime: true,
      birthTimePrecision: 'unknown',
      dayBoundaryPolicy: 'midnight'
    };
    const data = makeValidLoveReunionFormData();
    const missingPermission = validateLoveReunionFormData({
      ...data,
      partner,
      reunionContext: { ...data.reunionContext, partnerBirthKnown: true }
    });

    const result = validateLoveReunionFormData({
      ...data,
      partner,
      reunionContext: { ...data.reunionContext, partnerBirthKnown: true, partnerDataPermissionConfirmed: true }
    });

    expect(missingPermission.valid).toBe(false);
    expect(missingPermission.errors).toContain('상대방 출생정보를 제공하고 분석에 사용하는 데 필요한 권한을 확인해 주세요.');
    expect(result.valid).toBe(true);
    expect(result.partner?.valid).toBe(true);
    expect(result.partner?.normalizedPrecision).toBe('unknown');
  });

  it('hydrates partial or hostile legacy drafts through allowlists and text limits', () => {
    const oversizedNote = `  ${'가'.repeat(LOVE_REUNION_TEXT_LIMITS.lastContactNote + 30)}  `;
    const hydrated = hydrateLoveReunionFormData({
      name: '  사용자  ',
      relationshipState: 'closure',
      relationshipLength: 'unsupported-value',
      lastContactNote: oversizedNote,
      currentContact: 'friendly',
      breakupReason: 'other',
      partnerBirthKnown: 'yes',
      contactBoundary: 'unsafe-value',
      partnerDataPermissionConfirmed: 'yes',
      q1: 42
    });

    expect(hydrated.name).toBe('사용자');
    expect(hydrated.reunionContext.version).toBe(2);
    expect(hydrated.reunionContext.contactBoundary).toBe('');
    expect(hydrated.reunionContext.partnerDataPermissionConfirmed).toBe(false);
    expect(hydrated.reunionContext.relationshipState).toBe('closure');
    expect(hydrated.reunionContext.relationshipLength).toBe('');
    expect(hydrated.reunionContext.currentContact).toBe('friendly');
    expect(hydrated.reunionContext.breakupReason).toBe('other');
    expect(hydrated.reunionContext.partnerBirthKnown).toBe(false);
    expect(hydrated.reunionContext.lastContactNote).toHaveLength(LOVE_REUNION_TEXT_LIMITS.lastContactNote);
    expect(hydrated.q1).toBe('');
  });

  it('requires an explicit contact boundary selection', () => {
    const data = makeValidLoveReunionFormData();
    const result = validateLoveReunionFormData({
      ...data,
      reunionContext: { ...data.reunionContext, contactBoundary: '' }
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('연락 거절 또는 안전 경계 여부를 선택해 주세요.');
  });

  it('rejects a blocked contact state with a no-boundary claim', () => {
    const data = makeValidLoveReunionFormData();
    const contradictory = validateLoveReunionFormData({
      ...data,
      reunionContext: { ...data.reunionContext, currentContact: 'blocked', contactBoundary: 'none' }
    });
    const aligned = validateLoveReunionFormData({
      ...data,
      reunionContext: { ...data.reunionContext, currentContact: 'blocked', contactBoundary: 'explicit-no-contact' }
    });

    expect(contradictory.valid).toBe(false);
    expect(contradictory.errors).toContain('차단·연락 거절 상태에서는 명시적 비접촉 또는 안전 위험 경계를 선택해 주세요.');
    expect(aligned.valid).toBe(true);
  });

  it('migrates v1 drafts to safe v2 defaults', () => {
    const data = makeValidLoveReunionFormData();
    const migrated = hydrateLoveReunionFormData({
      ...data,
      reunionContext: {
        ...data.reunionContext,
        version: 1,
        contactBoundary: undefined,
        partnerDataPermissionConfirmed: undefined
      }
    });

    expect(migrated.reunionContext.version).toBe(2);
    expect(migrated.reunionContext.contactBoundary).toBe('');
    expect(migrated.reunionContext.partnerDataPermissionConfirmed).toBe(false);
  });

  it('requires details only for an other breakup reason', () => {
    const data = makeValidLoveReunionFormData();
    const missingOtherDetail = validateLoveReunionFormData({
      ...data,
      reunionContext: {
        ...data.reunionContext,
        breakupReason: 'other',
        breakupReasonDetail: ''
      }
    });
    const ordinaryReason = validateLoveReunionFormData(data);

    expect(missingOtherDetail.valid).toBe(false);
    expect(missingOtherDetail.errors).toContain('기타 이별 이유를 구체적으로 입력해 주세요.');
    expect(ordinaryReason.valid).toBe(true);
  });

  it('preserves both question originals and maps detailed relationship length for checkout', () => {
    const data = makeValidLoveReunionFormData();
    const q1 = '  연락을 먼저 해도 될까요?  ';
    const q2 = '상대 반응이 없을 때 제가 멈출 기준은 무엇인가요?\n';
    const prepared = prepareLoveReunionCheckoutFormData({
      ...data,
      q1,
      q2,
      relationshipStatus: 'single',
      relationshipDuration: 'under1',
      reunionContext: {
        ...data.reunionContext,
        relationshipLength: '3-to-5-years'
      }
    });

    expect(prepared.q1).toBe(q1);
    expect(prepared.q2).toBe(q2);
    expect(prepared.relationshipStatus).toBe('breakup-reunion');
    expect(prepared.relationshipDuration).toBe('under5');
  });

  it('exports stable, product-scoped session keys', () => {
    expect(LOVE_REUNION_DRAFT_KEY).toBe('unwoldang.intake.love-reunion');
    expect(LOVE_REUNION_CHECKOUT_INTENT_KEY).toBe('unwoldang.checkout.intent.love-reunion.v1');
    expect(LOVE_REUNION_DRAFT_KEY).not.toBe(LOVE_REUNION_CHECKOUT_INTENT_KEY);
  });
});
