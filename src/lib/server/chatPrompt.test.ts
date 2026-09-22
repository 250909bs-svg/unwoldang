import { describe, expect, it } from 'vitest';
import {
  CHAT_MAX_MESSAGE_LENGTH,
  buildChatRequestPayload,
  findChatRefusal,
  findChatReplyViolations,
  sanitizeChatMessage,
  trimChatHistory,
  type ChatNatalFacts
} from './chatPrompt';

const facts: ChatNatalFacts = {
  name: '운월',
  pillars: [
    { position: '연주', label: '병자' },
    { position: '월주', label: '경인' },
    { position: '일주', label: '경자' }
  ],
  hourKnown: false,
  dayMaster: '경',
  zodiac: '쥐',
  strengthLabel: '신약'
};

describe('운월 상담 프롬프트', () => {
  it('자해·자살은 사주로 답하지 않고 사람에게 연결한다', () => {
    /* 이 검사가 가장 먼저 걸려야 한다. 다른 주제와 겹쳐도 이쪽이 이긴다. */
    for (const message of ['요즘 죽고 싶어요', '자해를 했어요', '살기 싫습니다']) {
      const refusal = findChatRefusal(message);

      expect(refusal?.id, message).toBe('self-harm');
      expect(refusal?.reply).toContain('109');
    }
  });

  it('건강·법률·투자 판단은 거절하고 대신 무엇을 볼 수 있는지 말한다', () => {
    expect(findChatRefusal('제가 암에 걸릴까요?')?.id).toBe('medical');
    expect(findChatRefusal('이 소송 이길까요?')?.id).toBe('legal');
    expect(findChatRefusal('비트코인 지금 사도 될까요?')?.id).toBe('investment');

    // 거절만 하고 끝내지 않는다 — 할 수 있는 것을 함께 말한다.
    for (const topic of ['제가 암에 걸릴까요?', '이 소송 이길까요?', '주식 투자 해도 될까요?']) {
      expect(findChatRefusal(topic)?.reply).toMatch(/말씀드릴 수 있습니다|함께 볼 수 있습니다/);
    }
  });

  it('보통 질문은 막지 않는다', () => {
    for (const message of ['올해 연애운이 어떤가요?', '이직을 생각 중인데 시기가 궁금해요', '제 일간이 뭔가요?']) {
      expect(findChatRefusal(message), message).toBeNull();
    }
  });

  it('메시지를 다듬고 길이를 자른다', () => {
    expect(sanitizeChatMessage('  여러   줄\n\n입력  ')).toBe('여러 줄 입력');
    expect(sanitizeChatMessage('가'.repeat(900))).toHaveLength(CHAT_MAX_MESSAGE_LENGTH);
    expect(sanitizeChatMessage(null)).toBe('');
    expect(sanitizeChatMessage(42)).toBe('');
  });

  it('대화는 반드시 사용자 차례로 끝난다', () => {
    /* 운월의 말로 끝나면 모델이 자기 말에 이어 붙인다. */
    const trimmed = trimChatHistory([
      { role: 'user', text: '안녕하세요' },
      { role: 'unwol', text: '반갑습니다' }
    ]);

    expect(trimmed.at(-1)?.role).toBe('user');
    expect(trimmed).toHaveLength(1);
  });

  it('오래된 대화는 잘라 내고 최근 것을 남긴다', () => {
    const many = Array.from({ length: 40 }, (_, index) => ({
      role: (index % 2 === 0 ? 'user' : 'unwol') as const,
      text: `메시지 ${index}`
    }));

    const trimmed = trimChatHistory(many, 6);

    expect(trimmed.length).toBeLessThanOrEqual(6);
    expect(trimmed[0].text).not.toBe('메시지 0');
    expect(trimmed.at(-1)?.role).toBe('user');
  });

  it('빈 메시지는 대화에서 빠진다', () => {
    expect(
      trimChatHistory([
        { role: 'user', text: '   ' },
        { role: 'user', text: '질문' }
      ])
    ).toEqual([{ role: 'user', text: '질문' }]);
  });

  it('요청 본문이 확인된 사실만 싣고, 시간 미상을 함께 적는다', () => {
    const payload = buildChatRequestPayload({
      facts,
      history: [{ role: 'user', text: '올해 어떤가요?' }]
    });

    const system = payload.systemInstruction.parts[0].text;

    expect(system).toContain('연주 병자');
    expect(system).toContain('일간: 경');
    expect(system).toContain('출생시간: 미상');
    // 사실에 없는 것을 지어내지 말라는 규칙이 함께 간다.
    expect(system).toContain('지어내지 않는다');
    expect(system).toContain('확률·퍼센트·점수를 만들지 않는다');
  });

  it('모델 차례는 model, 사용자 차례는 user 로 넘어간다', () => {
    const payload = buildChatRequestPayload({
      facts,
      history: [
        { role: 'user', text: '첫 질문' },
        { role: 'unwol', text: '첫 답' },
        { role: 'user', text: '두번째 질문' }
      ]
    });

    expect(payload.contents.map((item) => item.role)).toEqual(['user', 'model', 'user']);
  });

  it('지어낸 정밀도가 답에 섞이면 잡아낸다', () => {
    /* 프롬프트로만 막으면 가끔 새는데, 새는 것이 하필 이런 숫자다. */
    expect(findChatReplyViolations('87% 확률로 좋아집니다')).toHaveLength(1);
    expect(findChatReplyViolations('올해 운은 80점입니다')).toHaveLength(1);
    expect(findChatReplyViolations('반드시 좋아집니다')).toHaveLength(1);
    expect(findChatReplyViolations('올해는 무리하지 않으시는 편이 낫겠습니다')).toEqual([]);
  });
});
