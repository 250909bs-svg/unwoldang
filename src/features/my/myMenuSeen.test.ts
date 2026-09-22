import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { markMyMenuSeen, readSeenMyMenuIds, shouldBadgeMyMenu } from './myMenuSeen';

/* 이 스위트는 node 환경에서 돈다. 귀연도 저장소 테스트와 같은 방식으로 window 를
   메모리 저장소로 세운다 — jsdom 을 끌어오는 것보다 가볍고 무엇이 있는지 분명하다. */
function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value)
  };
}

const seenOf = (...ids: string[]) => new Set(ids);

describe('마이 메뉴 N 배지', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: createMemoryStorage() }
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('열 수 있고, 보여 줄 것이 있고, 아직 안 봤을 때만 켠다', () => {
    expect(
      shouldBadgeMyMenu({ id: 'manseryeok', live: true, hasContent: true, seen: seenOf() })
    ).toBe(true);
  });

  it('준비 중인 줄에는 붙이지 않는다', () => {
    /* 눌러도 못 여는 줄에 "새 것" 이라고 하면 거짓말이다. */
    expect(
      shouldBadgeMyMenu({ id: 'chat', live: false, hasContent: true, seen: seenOf() })
    ).toBe(false);
  });

  it('보여 줄 것이 없으면 붙이지 않는다', () => {
    // 출생정보가 없으면 만세력은 빈 화면이다.
    expect(
      shouldBadgeMyMenu({ id: 'manseryeok', live: true, hasContent: false, seen: seenOf() })
    ).toBe(false);
  });

  it('한 번 열면 꺼지고 다시 켜지지 않는다', () => {
    expect(
      shouldBadgeMyMenu({ id: 'reports', live: true, hasContent: true, seen: seenOf('reports') })
    ).toBe(false);
  });

  it('본 기록은 남고 중복되지 않는다', () => {
    markMyMenuSeen('manseryeok');
    markMyMenuSeen('manseryeok');
    markMyMenuSeen('reports');

    expect([...readSeenMyMenuIds()].sort()).toEqual(['manseryeok', 'reports']);
  });

  it('빈 id 는 기록하지 않는다', () => {
    markMyMenuSeen('');

    expect(readSeenMyMenuIds().size).toBe(0);
  });

  it('저장소가 깨져 있어도 빈 목록으로 읽는다', () => {
    window.localStorage.setItem('unwoldang.my.seen', '{not json');

    expect(readSeenMyMenuIds().size).toBe(0);
    // 그 상태에서도 기록은 다시 시작된다.
    markMyMenuSeen('reports');
    expect([...readSeenMyMenuIds()]).toEqual(['reports']);
  });

  it('배열이 아닌 값이 들어 있어도 무너지지 않는다', () => {
    window.localStorage.setItem('unwoldang.my.seen', '{"a":1}');

    expect(readSeenMyMenuIds().size).toBe(0);
  });
});
