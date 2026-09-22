/**
 * 운월 상담 채팅의 프롬프트와 경계.
 *
 * 리포트는 결정론 엔진이 만든 사실 위에 문장만 모델이 쓴다. 채팅은 그럴 수 없다 —
 * 무엇을 물어볼지 모르기 때문이다. 그래서 반대로 간다: **모델이 볼 수 있는 사실을
 * 미리 다 넘기고, 그 밖의 것은 모른다고 말하게 한다.**
 *
 * 이 파일은 순수 함수만 갖는다. 네트워크도 키도 만지지 않아서 전부 테스트된다.
 */

export type ChatRole = 'user' | 'unwol';

export type ChatTurn = {
  role: ChatRole;
  text: string;
};

/** 모델에게 넘기는 사실 묶음. 여기 없는 것은 모델이 지어내면 안 되는 것이다. */
export type ChatNatalFacts = {
  name: string;
  pillars: { position: string; label: string }[];
  hourKnown: boolean;
  dayMaster: string;
  zodiac: string;
  strengthLabel: string;
};

export const CHAT_MAX_TURNS = 20;
export const CHAT_MAX_MESSAGE_LENGTH = 500;

/**
 * 답하지 않는 영역.
 *
 * 사주 상담이라는 간판 아래에서 의료·법률·투자 판단을 주면, 자격 없이 하는 조언이 되고
 * 듣는 사람은 그것을 근거로 실제 결정을 내린다. 자해·자살은 더 무겁다 — 여기서는
 * 사주로 답하지 않고 사람에게 연결한다.
 */
export const CHAT_REFUSAL_TOPICS = Object.freeze([
  {
    id: 'self-harm',
    /* 가장 먼저 검사한다. 다른 주제와 겹쳐도 이쪽이 이긴다. */
    patterns: [/자살/, /죽고\s*싶/, /자해/, /목숨을?\s*끊/, /살기\s*싫/],
    reply:
      '지금 많이 힘드신 것 같습니다. 그 마음은 사주로 답할 것이 아니라, 사람에게 바로 닿아야 하는 일입니다.\n\n' +
      '자살예방상담전화 **109** 는 24시간 무료로 연결됩니다. 정신건강상담전화 **1577-0199** 도 언제든 받습니다.\n\n' +
      '운월은 여기 있겠습니다. 연락하신 뒤에 다시 오셔도 됩니다.'
  },
  {
    id: 'medical',
    /* `\b` 를 쓰지 않는다. JS 의 단어 경계는 [A-Za-z0-9_] 로만 정의돼서 한글 사이에서는
       절대 성립하지 않는다 — `/암\b/` 는 "암에" 를 못 잡는다. */
    patterns: [/병\s*(있|없|걸)/, /암(에|이|으로|을|은|\s|$)/, /수술/, /약을?\s*(먹|끊)/, /진단/, /임신\s*가능/],
    reply:
      '건강은 사주로 판단할 일이 아닙니다. 몸에 관한 것은 진료를 보셔야 하고, 제가 대신 말해 드리면 그것이 판단을 늦춥니다.\n\n' +
      '대신 원국에서 읽히는 **생활의 결**은 말씀드릴 수 있습니다. 어떤 계절에 무리하기 쉬운지 같은 것이요.'
  },
  {
    id: 'legal',
    patterns: [/소송/, /고소/, /재판/, /변호사/, /합의금/],
    reply:
      '법적 판단은 제가 드릴 수 없습니다. 사주로 재판 결과를 말하면 그건 점이 아니라 무책임입니다.\n\n' +
      '다만 그 일을 대하는 **내 태도와 시기의 결**은 함께 볼 수 있습니다.'
  },
  {
    id: 'investment',
    patterns: [/주식/, /코인/, /비트코인/, /투자\s*(해|할까|하면)/, /부동산\s*(살|사도)/],
    reply:
      '어디에 얼마를 넣으라는 말씀은 드리지 않습니다. 사주로 특정 종목을 짚는 것은 근거가 없고, 손해는 그대로 남습니다.\n\n' +
      '재성의 흐름이 어떤 방식의 돈을 부르는지는 말씀드릴 수 있습니다.'
  }
]);

/** 물음이 답하지 않는 영역에 닿는지 본다. 닿으면 모델을 부르지 않는다. */
export function findChatRefusal(message: string) {
  const text = (message || '').trim();
  if (!text) return null;

  for (const topic of CHAT_REFUSAL_TOPICS) {
    if (topic.patterns.some((pattern) => pattern.test(text))) return topic;
  }

  return null;
}

export function sanitizeChatMessage(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX_MESSAGE_LENGTH) : '';
}

/**
 * 모델에 넘길 대화를 자른다.
 *
 * 최근 것부터 남기고, 반드시 사용자 차례로 끝난다 — 운월의 말로 끝나면 모델이 자기
 * 말에 이어 붙이려 한다.
 */
export function trimChatHistory(turns: readonly ChatTurn[], limit = CHAT_MAX_TURNS) {
  const cleaned = turns
    .map((turn) => ({ role: turn.role, text: sanitizeChatMessage(turn.text) }))
    .filter((turn) => turn.text);

  const trimmed = cleaned.slice(-limit);

  while (trimmed.length && trimmed[trimmed.length - 1].role !== 'user') trimmed.pop();

  return trimmed;
}

function describeFacts(facts: ChatNatalFacts) {
  const pillars = facts.pillars.map((pillar) => `${pillar.position} ${pillar.label}`).join(' · ');

  return [
    `이름: ${facts.name}`,
    `원국: ${pillars}`,
    facts.hourKnown ? '출생시간: 확인됨' : '출생시간: 미상 — 시주는 세우지 않았다',
    `일간: ${facts.dayMaster}`,
    `띠: ${facts.zodiac}`,
    `일간의 힘: ${facts.strengthLabel}`
  ].join('\n');
}

export const CHAT_SYSTEM_RULES = [
  '너는 운월당의 상담자 운월이다. 한국어 존댓말로만 말한다.',
  '아래 "확인된 사실" 에 있는 것만 이 사람의 명식으로 말할 수 있다.',
  '거기 없는 간지·대운·신살·연도를 새로 지어내지 않는다. 모르면 모른다고 말한다.',
  '출생시간이 미상이면 시주에 기대는 해석을 하지 않고, 그 사실을 함께 말한다.',
  '확률·퍼센트·점수를 만들지 않는다. "80% 확률" 같은 표현을 쓰지 않는다.',
  '단정하지 않는다. 확정된 미래가 아니라 지금 원국에서 읽히는 결로 말한다.',
  '건강·법률·투자 판단은 하지 않는다. 물어오면 할 수 없다고 말하고 대신 결을 말한다.',
  '답은 세 문단을 넘기지 않는다. 짧게, 그러나 근거를 한 번은 짚는다.'
].join('\n');

/** Gemini `generateContent` 본문. 이 함수는 네트워크를 만지지 않는다. */
export function buildChatRequestPayload(input: {
  facts: ChatNatalFacts;
  history: readonly ChatTurn[];
}) {
  return {
    systemInstruction: {
      role: 'system',
      parts: [{ text: `${CHAT_SYSTEM_RULES}\n\n확인된 사실\n${describeFacts(input.facts)}` }]
    },
    contents: trimChatHistory(input.history).map((turn) => ({
      role: turn.role === 'user' ? 'user' : 'model',
      parts: [{ text: turn.text }]
    })),
    generationConfig: {
      /* 상담은 같은 질문에 늘 같은 문장이면 사람이 아닌 티가 난다. 다만 사실은
         systemInstruction 이 잠그고 있으므로 온도가 사실을 흔들지는 않는다. */
      temperature: 0.7,
      maxOutputTokens: 700,
      topP: 0.9
    }
  };
}

/**
 * 모델 답에서 금지된 표현을 걸러낸다.
 *
 * 프롬프트로만 막으면 가끔 새는데, 새는 것이 하필 "87% 확률로" 같은 숫자다. 지어낸
 * 정밀도는 이 제품이 가장 피하려는 것이라 답을 받은 뒤 한 번 더 본다.
 */
export function findChatReplyViolations(reply: string) {
  const violations: string[] = [];
  const text = reply || '';

  if (/\d+\s*(%|퍼센트|프로)/.test(text)) violations.push('확률·퍼센트를 만들어 냈습니다.');
  /* 여기서도 `\b` 는 쓸 수 없다 — "80점입니다" 의 점과 입 사이에는 단어 경계가 없다. */
  if (/\d+\s*점/.test(text)) violations.push('점수를 만들어 냈습니다.');
  if (/반드시|틀림없이|무조건/.test(text)) violations.push('확정 단언을 썼습니다.');

  return violations;
}
