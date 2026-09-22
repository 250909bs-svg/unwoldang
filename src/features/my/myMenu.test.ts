import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MY_MENU_ENTRIES,
  liveMyMenuRoutes,
  myMenuEntriesByGroup,
  type MyMenuEntry
} from './myMenu';

const appSource = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');

const appRoutePaths = new Set(
  [...appSource.matchAll(/path="([^"]+)"/g)].map((match) => match[1])
);

describe('마이 메뉴', () => {
  it('live 항목은 App.tsx 에 실제로 있는 경로만 가리킨다', () => {
    /*
     * 이 테스트가 이 파일의 이유다. 메뉴를 JSX 안에 손으로 적으면 눌러도 404 인 줄이
     * 조용히 남는다. 여기서 막으면 라우트를 지우거나 이름을 바꿀 때 바로 드러난다.
     */
    for (const route of liveMyMenuRoutes()) {
      expect(appRoutePaths.has(route), `${route} 가 App.tsx 에 없다`).toBe(true);
    }
  });

  it('soon 항목은 경로가 없고, 왜 없는지 적혀 있다', () => {
    const soon = MY_MENU_ENTRIES.filter((entry) => entry.status === 'soon');

    expect(soon.length).toBeGreaterThan(0);
    for (const entry of soon) {
      expect(entry.to, `${entry.id} 는 경로가 없어야 한다`).toBeNull();
      // 근거 없는 "준비 중" 은 그냥 잊힌 항목과 구분되지 않는다.
      expect(entry.blockedBy?.length, `${entry.id} 에 blockedBy 가 없다`).toBeGreaterThan(20);
    }
  });

  it('live 항목에는 blockedBy 를 달지 않는다', () => {
    for (const entry of MY_MENU_ENTRIES.filter((item) => item.status === 'live')) {
      expect(entry.blockedBy, `${entry.id}`).toBeUndefined();
      expect(entry.to, `${entry.id}`).toBeTruthy();
    }
  });

  it('id 가 겹치지 않는다', () => {
    const ids = MY_MENU_ENTRIES.map((entry) => entry.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('보관함은 리포트 안으로 들어간다 — 별도 최상위 항목이 아니다', () => {
    const labels = MY_MENU_ENTRIES.map((entry) => entry.label);

    expect(labels).toContain('리포트');
    expect(labels).not.toContain('보관함');

    const reports = MY_MENU_ENTRIES.find((entry) => entry.id === 'reports') as MyMenuEntry;
    expect(reports.note).toContain('보관함');
    expect(reports.to).toBe('/my/reports');
  });

  it('강조 문구는 실제로 있는 혜택만 약속한다', () => {
    /* 초대 보상 쿠폰(FRIEND300)은 쿠폰 원장에 실재한다. 없는 혜택을 메뉴에 적으면
       누른 사람이 빈손으로 돌아온다. */
    const invite = MY_MENU_ENTRIES.find((entry) => entry.id === 'invite') as MyMenuEntry;

    expect(invite.accent).toBe('쿠폰 받기');
    expect(invite.status).toBe('live');

    // 준비 중인 줄에는 혜택을 약속하지 않는다.
    for (const entry of MY_MENU_ENTRIES.filter((item) => item.status === 'soon')) {
      expect(entry.accent, `${entry.id}`).toBeUndefined();
    }
  });

  it('그룹마다 항목이 있고, 한 항목은 한 그룹에만 속한다', () => {
    const primary = myMenuEntriesByGroup('primary');
    const share = myMenuEntriesByGroup('share');

    expect(primary.length).toBeGreaterThan(0);
    expect(share.length).toBeGreaterThan(0);
    expect(primary.filter((entry) => share.includes(entry))).toEqual([]);
    expect(primary.length + share.length + myMenuEntriesByGroup('support').length).toBe(
      MY_MENU_ENTRIES.length
    );
  });

  it('참고 화면의 문구를 그대로 쓰지 않는다', () => {
    /*
     * 구조만 참고하고 문장은 운월당 것을 쓴다는 규칙을 코드로 남긴다. 아래는 참고 화면에
     * 실제로 있던 표현들이다.
     */
    const borrowed = ['3초만에', '곳간', '즉시 지급', '무료이용권', '채널 추가'];
    const allCopy = MY_MENU_ENTRIES.map(
      (entry) => `${entry.label} ${entry.note || ''} ${entry.accent || ''}`
    ).join(' ');

    for (const phrase of borrowed) {
      expect(allCopy, `"${phrase}" 는 참고 화면의 문구다`).not.toContain(phrase);
    }
  });
});
