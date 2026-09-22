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
  /**
   * 한 줄 설명.
   *
   * 메뉴 목록에는 **그리지 않는다.** 줄마다 설명이 붙으면 목록이 아니라 글이 되고,
   * 훑어보는 속도가 사라진다. 설명이 필요한 두 가지는 위쪽 카드가 맡는다.
   * 이 값은 화면 밖에서 쓴다 — 접근성 이름과, 나중에 검색·도움말에 붙일 때.
   */
  note?: string;
  /** 줄 오른쪽에 붙는 강조 문구(예: 초대 보상). 화살표 앞에 놓인다. */
  accent?: string;
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
    note: '내 명식을 아는 운월에게 바로 물어봅니다',
    to: '/chat',
    status: 'live',
    requiresAuth: true,
    group: 'primary'
  },
  {
    id: 'coupon',
    label: '쿠폰',
    note: '받아 둔 할인 쿠폰을 확인하고 결제에 씁니다',
    to: '/my/coupons',
    status: 'live',
    requiresAuth: true,
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
    /* 실제로 있는 보상이다 — 초대에 답이 오면 FRIEND300 쿠폰이 지급된다
       (cloudrun-api/src/domains/coupons/couponCatalog.ts). 없는 혜택을 적지 않는다. */
    accent: '쿠폰 받기',
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
