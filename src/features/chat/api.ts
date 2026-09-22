import { getPortOneConfirmEndpoint } from '../../lib/runtimeConfig';

/**
 * 운월 상담 채팅의 클라이언트.
 *
 * 대화는 서버에 남지 않는다. 이 브라우저가 지금까지의 대화를 들고 있다가 매번 함께
 * 보낸다 — 사주 상담 내용은 사람이 가장 내놓기 싫어하는 글이라, 보관할 이유가 분명하지
 * 않으면 보관하지 않는 쪽이 맞다.
 */

export type ChatRole = 'user' | 'unwol';

export type ChatTurn = {
  role: ChatRole;
  text: string;
  /** 규칙으로 답한 차례. 화면이 다르게 표시한다. */
  guard?: boolean;
};

export type ChatFacts = {
  name: string;
  pillars: { position: string; label: string }[];
  hourKnown: boolean;
  dayMaster: string;
  zodiac: string;
  strengthLabel: string;
};

function chatEndpoint() {
  const base = getPortOneConfirmEndpoint();
  if (!base) return '';

  try {
    return `${new URL(base).origin}/api/chat`;
  } catch {
    return '';
  }
}

export function isChatAvailable() {
  return Boolean(chatEndpoint());
}

export async function askUnwol(options: {
  authToken: string;
  facts: ChatFacts;
  history: readonly ChatTurn[];
}): Promise<{ reply: string; guard: boolean }> {
  const endpoint = chatEndpoint();
  if (!endpoint) throw new Error('상담 서버에 연결할 수 없습니다.');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      facts: options.facts,
      history: options.history.map((turn) => ({ role: turn.role, text: turn.text }))
    })
  });

  const body = (await response.json().catch(() => ({}))) as {
    reply?: string;
    source?: string;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(typeof body.message === 'string' ? body.message : '운월이 답하지 못했습니다.');
  }

  return {
    reply: typeof body.reply === 'string' ? body.reply : '',
    guard: body.source === 'guard'
  };
}

const STORAGE_PREFIX = 'unwoldang.chat.';

/** 대화는 사용자별로 이 브라우저에만 둔다. 계정이 다르면 섞이지 않는다. */
export function readChatHistory(userId?: string): ChatTurn[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}${userId || 'guest'}`);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];

    return Array.isArray(parsed)
      ? parsed.filter(
          (turn): turn is ChatTurn =>
            Boolean(turn) &&
            typeof turn === 'object' &&
            typeof (turn as ChatTurn).text === 'string' &&
            ((turn as ChatTurn).role === 'user' || (turn as ChatTurn).role === 'unwol')
        )
      : [];
  } catch {
    return [];
  }
}

export function writeChatHistory(turns: readonly ChatTurn[], userId?: string) {
  if (typeof window === 'undefined') return;

  try {
    /* sessionStorage 를 쓴다. 탭을 닫으면 사라지는 편이 상담 내용에는 더 맞고,
       남의 폰을 잠깐 빌려 본 경우에도 남지 않는다. */
    window.sessionStorage.setItem(
      `${STORAGE_PREFIX}${userId || 'guest'}`,
      JSON.stringify(turns.slice(-40))
    );
  } catch {
    /* 저장이 막혀도 이번 대화는 화면에 그대로 남는다. */
  }
}

export function clearChatHistory(userId?: string) {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(`${STORAGE_PREFIX}${userId || 'guest'}`);
  } catch {
    /* 지우지 못해도 화면은 비운다. */
  }
}
