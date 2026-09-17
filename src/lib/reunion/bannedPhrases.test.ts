import { describe, expect, it } from 'vitest';
import {
  assertNoReunionBannedPhrases,
  findReunionBannedPhrases,
  getReunionBannedPhrases,
  serializeReunionBannedPhrases
} from './bannedPhrases';
import { REUNION_UNDELETABLE_COPY } from './safetyCopy';

const hitIds = (text: string, band?: Parameters<typeof findReunionBannedPhrases>[1]) =>
  findReunionBannedPhrases(text, band).map((hit) => hit.ruleId);

describe('reunion banned phrases', () => {
  it('catches identity branding and leaves behaviour descriptions alone', () => {
    expect(hitIds('외로운 사주라서 그래요.')).toContain('identity-branding');
    expect(hitIds('지윤님은 예민한 사람이에요.')).toContain('identity-branding');
    expect(hitIds('이 관계에서는 먼저 말을 꺼내는 쪽으로 작동했어요.')).toEqual([]);
  });

  it('catches probability claims but allows the report saying it is not a probability', () => {
    expect(hitIds('재회 가능성이 높아요.')).toContain('probability');
    expect(hitIds('재회 확률 72%입니다.')).toContain('probability');
    expect(hitIds('관계 회복 여건 지수 81점')).toContain('probability');
    expect(hitIds('재회 확률이 아니라 지윤님 명식의 월별 흐름이에요.')).toEqual([]);
  });

  it('catches surveillance prompts that section 6-B removed for every age', () => {
    expect(hitIds('상대의 SNS 반응을 보세요.')).toContain('surveillance');
    expect(hitIds('스토리를 다시 보는지 확인하세요.')).toContain('surveillance');
    expect(hitIds('공통 지인에게 물어보세요.')).toContain('surveillance');
    expect(hitIds('차단이 풀렸는지 매일 보세요.')).toContain('surveillance');
  });

  it('catches upsell, scolding, single-date prophecy and partner-mind claims', () => {
    expect(hitIds('부적을 하나 지니세요.')).toContain('upsell');
    expect(hitIds('매달리지 마세요.')).toContain('scolding');
    expect(hitIds('3월 12일에 연락이 옵니다.')).toContain('single-date-prophecy');
    expect(hitIds('그 사람은 아직 미련이 남아 있어요.')).toContain('partner-mind');
  });

  it('catches nicknames and any age or generation mention', () => {
    expect(hitIds('전남친에게')).toContain('partner-nickname');
    expect(hitIds('乙巳 · 30세 ~ 39세')).toContain('age-mention');
    expect(hitIds('30대 후반에는')).toContain('age-mention');
    expect(hitIds('乙巳 · 2024 ~ 2033')).toEqual([]);
  });

  it('adds band-specific bans on top of the common table', () => {
    expect(hitIds('아직 젊다고 말하지 않을게요.')).toEqual([]);
    expect(hitIds('아직 젊다고 말하지 않을게요.', 'thirties')).toContain('band:thirties');
    expect(getReunionBannedPhrases('thirties').length).toBeGreaterThan(
      getReunionBannedPhrases('neutral').length
    );
  });

  it('is stateless: the same text gives the same result twice', () => {
    const text = '재회 가능성이 높고 30세이며 부적이 필요합니다.';
    expect(findReunionBannedPhrases(text)).toEqual(findReunionBannedPhrases(text));
  });

  it('throws with every offending fragment named', () => {
    expect(() => assertNoReunionBannedPhrases('부적을 지니세요', undefined, 'CH03 c03-6')).toThrow(
      /CH03 c03-6.*부적/u
    );
    expect(() => assertNoReunionBannedPhrases('안전한 문장이에요')).not.toThrow();
  });

  it('serializes rules with their reason for the prompt', () => {
    const serialized = serializeReunionBannedPhrases('forties');
    expect(serialized).toContain('인격 낙인');
    expect(serialized).toContain('전남친');
  });

  it('passes every undeletable safety string it is meant to protect', () => {
    Object.entries(REUNION_UNDELETABLE_COPY).forEach(([id, copy]) => {
      expect(findReunionBannedPhrases(copy.replace(/\{name\}/gu, '지윤')), id).toEqual([]);
    });
  });
});
