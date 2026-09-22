/**
 * 마이 화면의 메뉴 한 장.
 *
 * 메뉴를 JSX 안에 직접 적으면 "누르면 아무 데도 안 가는 줄" 이 조용히 생긴다. 그래서
 * 항목마다 `status` 를 달고, `live` 는 App.tsx 에 실제로 있는 경로만 가리키게 테스트로
 * 고정한다(`myMenu.test.ts`). 아직 없는 기능은 `soon` 으로 두고 왜 없는지 `blockedBy` 에
 * 적는다 — 지금 없는 이유가 "깜빡함" 인지 "결제 연동 대기" 인지 구분되어야 한다.
 */

export type MyMenuStatus = 'live' | 'soon';

export type MyMenuGroup = 'primary' | 'share' | 'support';

export type MyMenuEntry = {
  id: string;
  label: string;
  /** 한 줄 설명. 메뉴 이름만으로 뭘 하는지 모르는 줄에만 붙인다. */
  note?: string;
  /** `live` 는 App.tsx 의 경로, `soon` 은 null. 그 대응을 테스트가 확인한다. */
  to: string | null;
  status: MyMenuStatus;
  /** `soon` 인 이유. 화면 문구가 아니라 판단 근거 기록이다. */
  blockedBy?: string;
  /** 로그인해야 의미가 있는 줄. 로그아웃 상태에서는 로그인으로 보낸다. */
  requiresAuth?: boolean;
  group: MyMenuGroup;
};

/**
 * 문구는 전부 운월당 것이다. 참고한 화면의 구조만 가져오고 문장·캐릭터·말투는 가져오지
 * 않는다. 운월당은 존댓말로 말한다.
 */
export const MY_MENU_ENTRIES: readonly MyMenuEntry[] = Object.freeze([
  {
    id: 'manseryeok',
    label: '내 만세력',
    note: '내 사주 원국을 네 기둥 그대로 펼쳐 봅니다',
    to: '/my/manseryeok',
    status: 'live',
    requiresAuth: true,
    group: 'primary'
  },
  {
    id: 'reports',
    label: '리포트',
    note: '받아 본 리포트를 보관함에 모아 다시 읽습니다',
    to: '/my/reports',
    status: 'live',
    requiresAuth: true,
    group: 'primary'
  },
  {
    id: 'daily-fortune',
    label: '오늘의 운세',
    note: '오늘 일진과 내 원국을 맞대어 하루를 읽습니다',
    to: '/today',
    status: 'live',
    requiresAuth: true,
    group: 'primary'
  },
  {
    id: 'chat',
    label: '채팅방',
    note: '상담 채팅은 아직 열지 않았습니다',
    to: null,
    status: 'soon',
    blockedBy:
      '실시간 서버와 신고·차단 장치가 없다. 사람 사이의 대화를 받는 기능이라 ' +
      '운영 책임이 함께 붙는다.',
    group: 'primary'
  },
  {
    id: 'coupon',
    label: '쿠폰',
    note: '결제가 열리면 함께 열립니다',
    to: null,
    status: 'soon',
    blockedBy:
      '쿠폰은 결제 금액을 깎는 물건이라 결제 연동(하이픈 키 대기) 뒤에만 뜻이 있다. ' +
      'lib/rewards.ts 의 지갑은 제거된 타로에만 붙어 있던 가짜 데이터이므로 쓰지 않는다.',
    group: 'primary'
  },
  {
    id: 'gift',
    label: '선물하기',
    note: '결제가 열리면 함께 열립니다',
    to: null,
    status: 'soon',
    blockedBy: '남의 몫을 결제해 주는 기능이라 결제 연동이 먼저다.',
    group: 'share'
  },
  {
    id: 'invite',
    label: '초대하기',
    note: '귀연도로 인연을 불러 두 사람의 명식을 이어 봅니다',
    to: '/guiyeondo',
    status: 'live',
    group: 'share'
  }
]);

export const MY_MENU_GROUP_ORDER: readonly MyMenuGroup[] = Object.freeze([
  'primary',
  'share',
  'support'
]);

export function myMenuEntriesByGroup(group: MyMenuGroup) {
  return MY_MENU_ENTRIES.filter((entry) => entry.group === group);
}

/** `live` 항목의 경로만. 테스트가 App.tsx 와 맞춰 보는 목록이다. */
export function liveMyMenuRoutes() {
  return MY_MENU_ENTRIES.filter((entry) => entry.status === 'live').map((entry) => entry.to as string);
}
