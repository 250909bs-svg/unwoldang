import { describe, expect, it } from 'vitest';
import { auditPastLifeNarrative, sanitizePastLifeNarrative } from './contentSafety';

describe('past-life-goblin narrative content safety', () => {
  it('preserves normal saju evidence, symbolic narrative, and present-life action copy', () => {
    const text =
      '갑목 일간과 현재 대운에서 반복되는 책임 기질을 상징 서사로 풀었습니다. 이번 주에는 부탁의 범위와 기한을 먼저 확인해 보세요.';

    expect(auditPastLifeNarrative(text)).toEqual({ safe: true, violations: [] });
    expect(sanitizePastLifeNarrative(text)).toBe(text);
  });

  it('keeps explicit limitations and non-commercial safety guidance', () => {
    const text =
      '이 서사는 실제 전생의 기억이나 검증된 역사적 사실을 증명하지 않습니다. 업은 벌이 아니라 반복 선택의 상징이며 부적이나 결제를 요구하지 않습니다.';

    expect(auditPastLifeNarrative(text)).toEqual({ safe: true, violations: [] });
    expect(sanitizePastLifeNarrative(text)).toBe(text);
  });

  it.each([
    'AI 회사로 이직하고 싶어요.',
    'ChatGPT 업무를 맡아요.',
  ])('preserves ordinary customer copy that merely names a technology: %s', (text) => {
    expect(auditPastLifeNarrative(text)).toEqual({ safe: true, violations: [] });
    expect(sanitizePastLifeNarrative(text)).toBe(text);
  });

  it('detects claims of recovered memories and certain past-life identities', () => {
    const text =
      '실제 전생의 기억이 돌아왔습니다. 당신의 전생은 조선 시대의 궁중 무당이었습니다.';

    expect(auditPastLifeNarrative(text)).toEqual({
      safe: false,
      violations: ['past-life-certainty'],
    });
  });

  it('detects a certain identity ending in 이었습니다', () => {
    const text = '당신의 전생은 조선 왕실의 재판관이었습니다.';

    expect(auditPastLifeNarrative(text)).toEqual({
      safe: false,
      violations: ['past-life-certainty'],
    });
  });

  it('does not let a safe disclaimer in the previous sentence mask a later certainty claim', () => {
    const text =
      '전생을 사실로 단정하지 않습니다. 하지만 당신의 전생은 조선 시대의 궁중 무당이었습니다.';

    expect(auditPastLifeNarrative(text)).toEqual({
      safe: false,
      violations: ['past-life-certainty'],
    });
  });

  it.each([
    '조선 시대의 궁중 무당이었습니다.',
    '상징적 표현이 아니라 당신의 전생은 조선 시대 재판관이었습니다.',
    '상징처럼 보이지만 당신의 전생은 무당이었습니다.',
  ])('detects historical identity certainty and symbolic-context bypass: %s', (text) => {
    expect(auditPastLifeNarrative(text)).toEqual({
      safe: false,
      violations: ['past-life-certainty'],
    });
  });

  it('keeps a historical role when the subject is explicitly a symbolic story character', () => {
    const text =
      '상징적 인물은 조선 시대의 궁중 무당이었습니다. 이 장면은 반복 기질을 비유하며 실제 인물이나 신분을 뜻하지 않습니다.';

    expect(auditPastLifeNarrative(text)).toEqual({
      safe: true,
      violations: [],
    });
    expect(sanitizePastLifeNarrative(text)).toBe(text);
  });

  it('detects claims presented as verified historical facts', () => {
    const text = '공식 사료로 확인된 검증된 역사적 사실입니다.';

    expect(auditPastLifeNarrative(text)).toEqual({
      safe: false,
      violations: ['verified-history-certainty'],
    });
  });

  it('detects certain death, curse, and karma claims', () => {
    const text =
      '당신은 전생에서 칼에 맞아 살해당했습니다. 지금의 이별은 전생의 업보 때문이며 저주가 확실히 남아 있습니다.';

    expect(auditPastLifeNarrative(text)).toEqual({
      safe: false,
      violations: ['death-certainty', 'curse-karma-certainty'],
    });
  });

  it('detects talisman and payment fear pressure', () => {
    const text = '부적을 지금 결제하지 않으면 저주가 풀리지 않고 큰 재앙이 옵니다.';

    expect(auditPastLifeNarrative(text)).toEqual({
      safe: false,
      violations: ['fear-payment-pressure'],
    });
  });

  it('detects AI, Gemini, and internal prompt leakage', () => {
    const text = 'Gemini 내부 프롬프트에 따라 AI가 생성한 결과입니다.';

    expect(auditPastLifeNarrative(text)).toEqual({
      safe: false,
      violations: ['internal-model-leak'],
    });
  });

  it('replaces the whole unsafe input without retaining evidence or dangerous details', () => {
    const text =
      '갑목 일간을 근거로 보면 당신은 전생에서 칼에 맞아 죽었습니다. 내부 프롬프트도 함께 공개합니다.';
    const sanitized = sanitizePastLifeNarrative(text);

    expect(sanitized).not.toContain('갑목');
    expect(sanitized).not.toContain('칼에 맞아');
    expect(sanitized).not.toContain('프롬프트');
    expect(sanitized).toContain('상징 서사');
    expect(sanitized).toContain('선택과 행동');
    expect(auditPastLifeNarrative(sanitized)).toEqual({ safe: true, violations: [] });
  });

  it('keeps empty input unchanged', () => {
    expect(auditPastLifeNarrative('')).toEqual({ safe: true, violations: [] });
    expect(sanitizePastLifeNarrative('')).toBe('');
  });
});
