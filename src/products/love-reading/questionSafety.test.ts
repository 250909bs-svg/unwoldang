import { describe, expect, it } from 'vitest';
import {
  getLoveReadingQuestionSafety,
  LOVE_READING_CRISIS_SAFETY_COPY
} from './questionSafety';

describe('love-reading question safety', () => {
  it.each([
    '요즘 죽고 싶다는 생각이 들어요',
    '왜 살아야 할 이유가 있나요?',
    '그냥 사라지고 싶어',
    '자해하고 싶은 충동이 있어요',
    '차라리 죽는 게 나을 것 같아요',
    '정말 죽을 것 같아요',
    '인생을 끝내고 싶어요',
    '삶을 포기하고 싶어요',
    '이제 다 포기하고 싶어요'
  ])('detects a high-confidence self-harm context: %s', (question) => {
    expect(getLoveReadingQuestionSafety(question)).toBe(LOVE_READING_CRISIS_SAFETY_COPY);
  });

  it('returns the complete fixed emergency guidance', () => {
    const copy = getLoveReadingQuestionSafety('살기 싫어요');
    const combined = [copy?.message, ...(copy?.actions ?? [])].join(' ');

    expect(combined).toContain('109');
    expect(combined).toContain('119');
    expect(combined).toContain('112');
    expect(combined).toContain('해외');
    expect(combined).toContain('현지 응급번호');
    expect(combined).toContain('다음 10분');
  });

  it.each([
    '이 관계에서 무엇을 확인하면 좋을까요?',
    '이 관계를 끝내고 싶어요',
    '이 연애를 포기하고 싶어요',
    '상대를 극단적으로 밀어내는 패턴을 고치고 싶어요',
    '너 때문에 못 살겠어'
  ])('does not replace an ordinary relationship decision: %s', (question) => {
    expect(getLoveReadingQuestionSafety(question)).toBeNull();
  });

  it('ignores missing questions', () => {
    expect(getLoveReadingQuestionSafety(undefined)).toBeNull();
  });
});
