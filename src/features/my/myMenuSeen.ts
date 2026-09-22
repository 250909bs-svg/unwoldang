/**
 * 메뉴의 N 배지 — "아직 안 열어 본 것".
 *
 * 배지를 늘 켜 두면 그건 장식이지 알림이 아니다. 그래서 한 번 열면 꺼지고, 다시는
 * 켜지지 않는다. 기록은 이 브라우저에만 남는다 — 서버에 둘 만한 무게의 정보가 아니고,
 * 지워져서 배지가 한 번 더 뜨는 것이 최악이다.
 */

const STORAGE_KEY = 'unwoldang.my.seen';

function read(): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];

    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function readSeenMyMenuIds(): ReadonlySet<string> {
  return new Set(read());
}

export function markMyMenuSeen(id: string) {
  if (typeof window === 'undefined' || !id) return;

  try {
    const next = [...new Set([...read(), id])].slice(-40);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* 저장이 막혀도 화면은 그대로 돈다. 배지가 다음에 한 번 더 뜰 뿐이다. */
  }
}

/**
 * 배지를 붙일지 정한다.
 *
 * 세 조건을 모두 만족할 때만 켠다.
 *   1) 실제로 열리는 항목이다(준비 중에는 붙이지 않는다 — 눌러도 못 여는데 새 것이라 하면 거짓말이다)
 *   2) 그 화면에 지금 보여 줄 것이 있다
 *   3) 아직 한 번도 열지 않았다
 */
export function shouldBadgeMyMenu(input: {
  id: string;
  live: boolean;
  hasContent: boolean;
  seen: ReadonlySet<string>;
}) {
  return input.live && input.hasContent && !input.seen.has(input.id);
}
