import { PaymentRequestError } from '../../contracts/errors.ts';
import {
  buildChatRequestPayload,
  findChatRefusal,
  findChatReplyViolations,
  sanitizeChatMessage,
  trimChatHistory,
  type ChatNatalFacts,
  type ChatTurn
} from '../../../../src/lib/server/chatPrompt.ts';

/**
 * 운월 상담 채팅.
 *
 * 대화는 서버에 저장하지 않는다. 클라이언트가 지금까지의 대화를 매번 함께 보내고,
 * 서버는 답 하나를 만들어 돌려준다. 사주 상담 내용은 사람이 가장 내놓기 싫어하는
 * 종류의 글이라, 보관할 이유가 분명하지 않으면 보관하지 않는 쪽이 맞다.
 *
 * 사실 경계: 모델은 요청에 실린 명식 말고 다른 것을 이 사람의 사주라고 말하면 안 된다.
 * 그 규칙은 `chatPrompt.ts` 의 systemInstruction 이 지고, 답을 받은 뒤 한 번 더 본다.
 */

export type ChatServiceConfig = {
  model: string;
  requestTimeoutMs: number;
};

export type ChatServiceDependencies = {
  config: ChatServiceConfig;
  /**
   * API 키를 읽는 함수.
   *
   * 키를 `AppConfig` 에 담지 않는다 — 그 객체는 `/health` 와 로그 여러 곳을 돌아다니고,
   * 거기 키가 실려 있으면 언젠가 찍힌다. 설정은 "있는가" 만 말하고, 실제 값은 쓸 때
   * 환경에서 직접 읽는다. 리포트 쪽도 같은 방식이다.
   */
  readApiKey?: () => string;
  fetchImplementation?: typeof fetch;
  now?: () => number;
};

export type ChatReply = {
  reply: string;
  /* 모델을 부르지 않고 규칙으로 답한 경우. 화면이 안내 문구를 다르게 그린다. */
  source: 'guard' | 'model';
  guardTopic?: string;
};

function readFacts(body: Record<string, unknown>): ChatNatalFacts {
  const facts = body.facts as Partial<ChatNatalFacts> | undefined;
  const pillars = Array.isArray(facts?.pillars) ? facts.pillars : [];

  if (!facts || !pillars.length || typeof facts.dayMaster !== 'string' || !facts.dayMaster) {
    throw new PaymentRequestError(400, '먼저 출생정보로 원국을 세워 주세요.');
  }

  return {
    name: sanitizeChatMessage(facts.name) || '고객',
    pillars: pillars
      .filter((pillar) => pillar && typeof pillar.label === 'string')
      .slice(0, 4)
      .map((pillar) => ({
        position: sanitizeChatMessage(pillar.position).slice(0, 8),
        label: sanitizeChatMessage(pillar.label).slice(0, 8)
      })),
    hourKnown: Boolean(facts.hourKnown),
    dayMaster: sanitizeChatMessage(facts.dayMaster).slice(0, 4),
    zodiac: sanitizeChatMessage(facts.zodiac).slice(0, 8),
    strengthLabel: sanitizeChatMessage(facts.strengthLabel).slice(0, 12)
  };
}

function readHistory(body: Record<string, unknown>): ChatTurn[] {
  const raw = Array.isArray(body.history) ? body.history : [];

  return raw
    .filter((turn): turn is Record<string, unknown> => Boolean(turn) && typeof turn === 'object')
    .map((turn) => ({
      role: turn.role === 'unwol' ? ('unwol' as const) : ('user' as const),
      text: sanitizeChatMessage(turn.text)
    }))
    .filter((turn) => turn.text);
}

export class ChatService {
  private readonly fetchImplementation: typeof fetch;
  private readonly readApiKey: () => string;

  constructor(private readonly dependencies: ChatServiceDependencies) {
    this.fetchImplementation = dependencies.fetchImplementation || globalThis.fetch;
    this.readApiKey = dependencies.readApiKey || (() => (process.env.GEMINI_API_KEY || '').trim());
  }

  get configured() {
    return Boolean(this.readApiKey());
  }

  async reply(body: Record<string, unknown>): Promise<ChatReply> {
    const history = readHistory(body);
    const trimmed = trimChatHistory(history);
    const latest = trimmed.at(-1);

    if (!latest) throw new PaymentRequestError(400, '보낼 말씀을 입력해 주세요.');

    /*
     * 먼저 경계를 본다. 답하지 않기로 한 주제는 **모델을 부르지 않는다** — 프롬프트로
     * 부탁하는 것보다 아예 묻지 않는 쪽이 확실하고, 자해 문항에서는 그 확실함이 중요하다.
     */
    const refusal = findChatRefusal(latest.text);
    if (refusal) {
      return { reply: refusal.reply, source: 'guard', guardTopic: refusal.id };
    }

    if (!this.configured) {
      throw new PaymentRequestError(503, '상담이 잠시 열리지 않았습니다. 곧 다시 열겠습니다.');
    }

    const facts = readFacts(body);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.dependencies.config.requestTimeoutMs);

    let response: Response;

    try {
      response = await this.fetchImplementation(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.dependencies.config.model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.readApiKey()
          },
          signal: controller.signal,
          body: JSON.stringify(buildChatRequestPayload({ facts, history: trimmed }))
        }
      );
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      throw new PaymentRequestError(
        504,
        aborted ? '운월이 답을 고르는 데 시간이 걸리고 있어요. 다시 여쭤봐 주세요.' : '상담 연결에 실패했습니다.'
      );
    } finally {
      clearTimeout(timeout);
    }

    const parsed = (await response.json()) as {
      error?: { message?: string };
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    if (!response.ok) {
      /* 모델의 원문 오류를 손님 화면에 그대로 올리지 않는다. 키·할당량 같은 운영
         사정이 섞여 있고, 손님이 할 수 있는 일이 없다. */
      console.error('[chat] Gemini 응답 실패', parsed?.error?.message || response.status);
      throw new PaymentRequestError(503, '상담이 잠시 열리지 않았습니다. 곧 다시 열겠습니다.');
    }

    const text = (parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();

    if (!text) throw new PaymentRequestError(503, '운월이 답을 만들지 못했습니다. 다시 여쭤봐 주세요.');

    const violations = findChatReplyViolations(text);

    if (violations.length) {
      /* 지어낸 정밀도가 섞였다. 그 답을 그대로 내보내느니 없는 편이 낫다 —
         "87% 확률" 은 이 제품이 가장 피하려는 종류의 문장이다. */
      console.error('[chat] 답변 규칙 위반', violations.join(' / '));
      return {
        reply:
          '방금은 제가 근거 없이 단정할 뻔했습니다. 다시 여쭤봐 주시면 원국에서 읽히는 만큼만 말씀드리겠습니다.',
        source: 'guard',
        guardTopic: 'reply-violation'
      };
    }

    return { reply: text, source: 'model' };
  }
}
