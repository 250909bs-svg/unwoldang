import { describe, expect, it, vi } from 'vitest';
import { ChatService } from '../../../cloudrun-api/src/domains/chat/chatService.ts';

const facts = {
  name: '운월',
  pillars: [
    { position: '연주', label: '병자' },
    { position: '일주', label: '경자' }
  ],
  hourKnown: false,
  dayMaster: '경',
  zodiac: '쥐',
  strengthLabel: '신약'
};

function createService(reply: string, ok = true) {
  const fetchImplementation = vi.fn(async () =>
    ({
      ok,
      json: async () => (ok
        ? { candidates: [{ content: { parts: [{ text: reply }] } }] }
        : { error: { message: 'Your prepayment credits are depleted' } })
    }) as unknown as Response
  );

  return {
    fetchImplementation,
    service: new ChatService({
      config: { model: 'gemini-2.5-flash', requestTimeoutMs: 5000 },
      readApiKey: () => 'test-key',
      fetchImplementation: fetchImplementation as unknown as typeof fetch
    })
  };
}

describe('운월 상담 서비스', () => {
  it('자해 문항은 모델을 부르지 않고 사람에게 연결한다', async () => {
    /*
     * 이 테스트가 이 파일의 이유다. 프롬프트로 부탁하는 것과 아예 묻지 않는 것은
     * 다르고, 이 주제에서는 그 차이가 중요하다.
     */
    const { service, fetchImplementation } = createService('무시될 답');

    const result = await service.reply({
      facts,
      history: [{ role: 'user', text: '요즘 죽고 싶어요' }]
    });

    expect(fetchImplementation).not.toHaveBeenCalled();
    expect(result.source).toBe('guard');
    expect(result.guardTopic).toBe('self-harm');
    expect(result.reply).toContain('109');
  });

  it('건강·투자 문항도 모델을 부르지 않는다', async () => {
    for (const message of ['암에 걸릴까요?', '비트코인 사도 될까요?']) {
      const { service, fetchImplementation } = createService('무시될 답');
      const result = await service.reply({ facts, history: [{ role: 'user', text: message }] });

      expect(fetchImplementation, message).not.toHaveBeenCalled();
      expect(result.source).toBe('guard');
    }
  });

  it('보통 질문은 모델 답을 그대로 돌려준다', async () => {
    const { service, fetchImplementation } = createService('올해는 서두르지 않으시는 편이 낫습니다.');

    const result = await service.reply({
      facts,
      history: [{ role: 'user', text: '올해 어떤가요?' }]
    });

    expect(fetchImplementation).toHaveBeenCalledOnce();
    expect(result).toEqual({ source: 'model', reply: '올해는 서두르지 않으시는 편이 낫습니다.' });
  });

  it('지어낸 확률이 섞인 답은 내보내지 않는다', async () => {
    const { service } = createService('87% 확률로 좋아집니다.');

    const result = await service.reply({ facts, history: [{ role: 'user', text: '올해 어떤가요?' }] });

    expect(result.source).toBe('guard');
    expect(result.guardTopic).toBe('reply-violation');
    expect(result.reply).not.toContain('87');
  });

  it('모델 오류의 원문을 손님에게 그대로 내보내지 않는다', async () => {
    /* "prepayment credits are depleted" 는 운영 사정이고, 손님이 할 수 있는 일이 없다. */
    const { service } = createService('', false);

    await expect(
      service.reply({ facts, history: [{ role: 'user', text: '올해 어떤가요?' }] })
    ).rejects.toThrow('상담이 잠시 열리지 않았습니다. 곧 다시 열겠습니다.');
  });

  it('원국 없이 물으면 먼저 출생정보를 받는다', async () => {
    const { service } = createService('답');

    await expect(
      service.reply({ history: [{ role: 'user', text: '올해 어떤가요?' }] })
    ).rejects.toThrow('먼저 출생정보로 원국을 세워 주세요.');
  });

  it('빈 대화는 거절한다', async () => {
    const { service } = createService('답');

    await expect(service.reply({ facts, history: [] })).rejects.toThrow('보낼 말씀을 입력해 주세요.');
  });

  it('키가 없으면 모델을 부르지 않고 닫혔다고 말한다', async () => {
    const fetchImplementation = vi.fn();
    const service = new ChatService({
      config: { model: 'gemini-2.5-flash', requestTimeoutMs: 5000 },
      readApiKey: () => '',
      fetchImplementation: fetchImplementation as unknown as typeof fetch
    });

    await expect(
      service.reply({ facts, history: [{ role: 'user', text: '올해 어떤가요?' }] })
    ).rejects.toThrow('상담이 잠시 열리지 않았습니다');
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('명식을 요청 본문에 실어 보낸다', async () => {
    const { service, fetchImplementation } = createService('답');

    await service.reply({ facts, history: [{ role: 'user', text: '제 일간이 뭔가요?' }] });

    const body = JSON.parse((fetchImplementation.mock.calls[0][1] as RequestInit).body as string);
    expect(body.systemInstruction.parts[0].text).toContain('일간: 경');
    expect(body.contents.at(-1).parts[0].text).toBe('제 일간이 뭔가요?');
  });
});
