/**
 * 운월당 재회운 웹툰형 상세페이지 — 20패널 문구.
 *
 * 화법 규칙 (어기면 브랜드가 무너진다):
 * - 서술자는 언제나 운월당이고 언제나 존댓말이다. 화자 캐릭터를 만들지 않는다.
 * - 말풍선(bubbles)은 오직 독자 본인의 속마음이다. 반말 독백은 되지만
 *   지시·판단·약속·수치·시기는 절대 넣지 않는다.
 * - 안전/고지 패널(kind: 'safety' | 'offer')에는 말풍선을 두지 않는다. 타입으로 막아 두었다.
 * - 숫자는 코드로 검증되는 것만 쓴다. 이용자 수·후기 수·언론 실적·정가 대비 할인은 쓰지 않는다.
 * - 금지 표현은 범주 명사구로만 적는다. 금지 문장의 원형을 예시로 완성해 쓰지 않는다.
 *
 * 표기: '\n' 은 렌더 시 <br />, [대괄호] 는 <em class="rw-hot"> 강조.
 */

import type { ReunionPanelId } from '../features/reunion/reunionPanelAssets';

export type ReunionCutKind =
  | 'cover'
  | 'silence'
  | 'talk'
  | 'art'
  | 'plate'
  | 'list'
  | 'cards'
  | 'compare'
  | 'deny'
  | 'panes'
  | 'sample'
  | 'branch'
  | 'gauge'
  | 'window'
  | 'safety'
  | 'offer';

export type ReunionCutMechanic =
  | 'stopList'
  | 'standards'
  | 'compare'
  | 'deny'
  | 'parts'
  | 'panes'
  | 'myeongsik'
  | 'branch'
  | 'gaugeTimeline'
  | 'timingBand'
  | 'gate';

export type ReunionBubble = {
  /** '\n' 으로 줄바꿈을 직접 통제한다. 6~30자, 최대 2줄. */
  text: string;
  side: 'left' | 'right';
  /** 무대 기준 세로 위치. 한 패널에 2개면 50%p 이상 벌린다. */
  top: string;
  /** 스태거 순서 */
  i: 0 | 1;
};

type BaseCut = {
  n: ReunionPanelId;
  act: 1 | 2 | 3 | 4;
  kind: ReunionCutKind;
  /** --rw-h. 균일하면 리듬이 죽는다. */
  height: number;
  kicker?: string;
  /** 마스킹·블러 예시 블록이 있는 패널에는 예외 없이 붙인다. */
  badge?: string;
  plate?: { seal: string; act: string; title: string };
  headline?: string;
  /** 침묵 컷 대사 */
  silent?: string;
  body?: string;
  /** 운월당 서술 박스. 존댓말 전용. */
  note?: string;
  caption?: string;
  gaugeCaption?: string;
  bandNote?: string;
  tallyFoot?: string;
  mechanic?: ReunionCutMechanic;
  chapterFoot?: string;
};

/** 안전·고지 패널에는 말풍선을 놓지 않는다(타입 수준 강제). */
export type ReunionCut =
  | (BaseCut & { kind: 'safety' | 'offer'; bubbles?: never })
  | (BaseCut & { bubbles?: ReunionBubble[] });

/* ── 목록 상수 ─────────────────────────────────────────────── */

/** reportPresentation.ts 의 baseProhibitedActions 원문과 일치시킨다. */
export const stopActions = [
  '답이 없는데 같은 내용으로 반복 연락하기',
  '친구나 가족을 통해 반응을 확인하기',
  '온라인 상태나 SNS 반응을 동의처럼 해석하기',
  '운세 결과를 근거로 답변이나 만남을 요구하기'
] as const;

export const standards = [
  {
    icon: 'calendar',
    title: '시기보다 조건을 먼저',
    body: '좋다는 날짜 하나를 찍기보다, 연락해도 되는 신호와 멈춰야 할 신호를 함께 봅니다.'
  },
  {
    icon: 'message',
    title: '마음 대신 행동을 확인',
    body: '상대의 속마음을 사실처럼 단정하지 않고, 실제 응답과 경계 표현을 판단 기준으로 둡니다.'
  },
  {
    icon: 'shield',
    title: '재회와 정리를 모두 존중',
    body: '다시 만나는 것만 정답으로 몰지 않고, 나를 지키며 멈춰야 하는 경우도 분명히 안내합니다.'
  }
] as const;

export const compareGuess = [
  '읽음 표시로 마음 짐작하기',
  '좋다는 날짜 하나에 걸기',
  '친구에게 반응 물어보기',
  '답이 없을 때 이유 만들어내기'
] as const;

export const compareReport = [
  '연락 상태 5가지 중 지금의 위치',
  '연락해도 되는 조건 3가지',
  '지금 하지 않을 행동 4가지',
  '오늘·7일·30일에 할 일 8가지'
] as const;

/**
 * 재회운 리포트가 출력하지 않는 표현.
 * 반드시 범주 명사구로만 적는다. 금지 문장의 원형을 완성해 쓰지 않는다.
 * 아래 "걸리면 리포트를 발행하지 않습니다" 한 줄에서 절대 확장하지 않는다.
 */
export const denyItems = [
  '재회 확률 퍼센트',
  '상대의 속마음 단정',
  '재회 날짜 확정',
  "'반드시'·'무조건' 같은 단정 표현"
] as const;

export const reportParts = [
  '두 사람의 명식에서 확인되는 관계 리듬',
  '연락을 시도해도 되는 현실 조건',
  '지금 피해야 할 연락과 행동',
  '오늘·7일·30일 행동 가이드',
  '재회 뒤 같은 이별을 막는 지속 조건'
] as const;

export const userPane = [
  { label: '이별 후 기간', value: '○○ · ○' },
  { label: '현재 연락 상태', value: '○○ · ○' },
  { label: '이별 배경', value: '○○ · ○' },
  { label: '원하는 결과', value: '○○ · ○' }
] as const;

/**
 * 패널 13 오른쪽 칸. 라벨만 태그로 보여준다(값 없음).
 * 값을 마스킹해 함께 보여주면 바로 다음 패널 14 의 명식 표와 같은 표가 두 번 나온다.
 * 13 은 "입력과 계산을 섞지 않는다"는 원칙, 14 는 "계산 결과의 실제 형태" 로 역할을 나눈다.
 */
export const calcTags = ['본인 일간', '원국 오행', '도움 오행', '현재 대운'] as const;

/**
 * 패널 14 명식 표. reportPresentation.ts 의 sajuFacts 네 줄과 1:1 로 대응한다.
 * 값은 전부 마스킹이고 라벨·구조만 실물과 같다. 없는 항목을 만들어 붙이지 않는다.
 * (재회운 리포트는 4기둥 원국표를 출력하지 않으므로 여기에도 만들지 않는다.)
 */
export const myeongsik = {
  dayMaster: { label: '본인 일간', stem: '○', element: '○' },
  elementsLabel: '원국 오행',
  /** el 값은 CSS 의 --rw-el-* 토큰 키와 일치해야 한다. */
  elements: [
    { el: 'wood', name: '목', count: '○' },
    { el: 'fire', name: '화', count: '○' },
    { el: 'earth', name: '토', count: '○' },
    { el: 'metal', name: '금', count: '○' },
    { el: 'water', name: '수', count: '○' }
  ],
  helpful: { label: '도움 오행', chips: ['○', '○'] },
  dayun: { label: '현재 대운', value: '○○ 대운 · ○○○○~○○○○' }
} as const;

/** contactStatusLabels(reunionFlow.ts) 5분기와 1:1 로 맞춘다. */
export const branchRows = [
  { label: '현재 연락하지 않아요', chip: '조건부', verdict: 'conditional' },
  { label: '가끔 안부만 주고받아요', chip: '조건부', verdict: 'conditional' },
  { label: '지금도 대화하고 있어요', chip: '열림', verdict: 'open' },
  { label: '차단되었거나 연락을 거절했어요', chip: '보류', verdict: 'withheld' },
  { label: '상태를 판단하기 어려워요', chip: '보류', verdict: 'withheld' }
] as const;

export const actionTimeline = [
  { when: '오늘', count: '2가지' },
  { when: '7일 안에', count: '3가지' },
  { when: '30일 안에', count: '3가지' }
] as const;

export const tallyItems = [
  { num: '4', unit: '줄', label: '명식 사실' },
  { num: '8', unit: '개', label: '행동 항목' },
  { num: '1', unit: '곳', label: '참고 구간' }
] as const;

export const gateSteps = [
  '4단계 입력 (약 3분)',
  '결제 전 무료 미리보기',
  '카카오 로그인',
  '990원 결제 후 웹에서 바로 열람'
] as const;

export const legalItems = [
  '재회운 · 990원 · 1회 결제 · 디지털 콘텐츠(웹에서 즉시 열람)',
  '4단계 입력 → 결제 전 무료 미리보기 → 카카오 로그인 → 결제 → 리포트 열람',
  '상대방이 제공했거나 서비스 이용에 동의한 정보만 입력합니다.',
  '리포트가 생성되어 열람 가능한 상태가 된 뒤에는 디지털 콘텐츠 특성상 환불이 제한될 수 있습니다.',
  '본 콘텐츠는 전통 명리학 기반의 참고 자료이며 상대방의 연락, 감정 또는 재회를 보장하지 않습니다.'
] as const;

/** src/components/Footer.tsx 와 한 글자까지 일치해야 한다. */
export const footerLines = [
  'ⓒ 2025 케이컴퍼니 | 대표: 김명숙 | 사업자등록번호: 308-13-16314',
  '통신판매업 신고번호: 제 2025-서울구로-0005호',
  '주소: 서울특별시 구로구 구로동180-3',
  '상호명: 케이컴퍼니(운월당)',
  '고객센터 전화: 050420111894 | 이메일: 250909bs@gmail.com',
  '개인정보보호책임자: 차민호'
] as const;

export const actTitles: Readonly<Record<1 | 2 | 3 | 4, string>> = {
  1: '첫째 마당 · 그 밤',
  2: '둘째 마당 · 운월당이 지키는 것',
  3: '셋째 마당 · 무엇을 계산하고, 무엇을 계산하지 않는가',
  4: '넷째 마당 · 어느 쪽이든'
};

/* ── 20패널 ────────────────────────────────────────────────── */

export const reunionCuts: readonly ReunionCut[] = [
  /* 첫째 마당 · 그 밤 */
  {
    n: '01',
    act: 1,
    kind: 'cover',
    height: 840,
    kicker: '운월당 · 재회운',
    headline: '다시 연락해도 될까,\n이제는 [멈춰야] 할까',
    body: '두 사람의 명리 흐름과 지금의 연락 상황을 나눠 보고, 기대가 아닌 행동 기준으로 다음 한 걸음을 정리해 드려요.'
  },
  {
    n: '02',
    act: 1,
    kind: 'silence',
    height: 340,
    silent: '읽음.'
  },
  {
    n: '03',
    act: 1,
    kind: 'talk',
    height: 500,
    kicker: '첫째 마당 · 밤',
    headline: '대화창 위에서\n멈춘 [손]',
    bubbles: [
      { text: '또 프로필에 들어갔다.', side: 'left', top: '9%', i: 0 },
      { text: '보낼 말은 다 썼는데,\n손가락이 안 눌린다.', side: 'right', top: '61%', i: 1 }
    ]
  },
  {
    n: '04',
    act: 1,
    kind: 'art',
    height: 600,
    kicker: '첫째 마당 · 밤',
    headline: '작은 반응이\n[크게] 읽히는 시기',
    body: '읽음 표시, 프로필 사진, 새벽의 접속 시간. 이별 뒤에는 어떤 신호든 답처럼 보입니다.',
    bubbles: [{ text: '오늘도 그 방만\n열었다 닫았다.', side: 'left', top: '12%', i: 0 }],
    note: "운월당은 이 신호들을 사실로 올려 두지 않습니다. 알려주신 상황에는 '사용자 입력 · 미확인' 표시가 그대로 붙습니다."
  },
  {
    n: '05',
    act: 1,
    kind: 'silence',
    height: 360,
    silent: '끊겼다.'
  },
  {
    n: '06',
    act: 1,
    kind: 'list',
    height: 940,
    kicker: '첫째 마당 · 밤',
    headline: '리포트가 먼저\n[멈추라고] 안내하는 네 가지',
    body: '지금 하고 있어도 이상한 일이 아닙니다. 다만 결과를 받기 전에 먼저 멈추라고 안내하는 행동들입니다.',
    bubbles: [{ text: '이건 나도 알아.', side: 'right', top: '6%', i: 0 }],
    mechanic: 'stopList',
    note: "차단되었거나 연락을 거절당한 상태라면 '다른 번호나 계정으로 우회 연락하기'가 한 줄 더 붙습니다.",
    chapterFoot: '운월당 재회운 · 첫째 마당'
  },

  /* 둘째 마당 · 운월당이 지키는 것 */
  {
    n: '07',
    act: 2,
    kind: 'plate',
    height: 400,
    plate: { seal: '雲月堂', act: '둘째 마당', title: '운월당이 지키는 것' },
    body: '재회운은 세 가지 기준 위에서만 문장을 만듭니다.'
  },
  {
    n: '08',
    act: 2,
    kind: 'cards',
    height: 660,
    kicker: '둘째 마당 · 원칙',
    headline: '재회를 확률로\n[단정하지] 않습니다',
    body: '관계는 두 사람의 선택으로 움직입니다. 사주는 그 선택을 점검하는 참고 근거로 씁니다.',
    mechanic: 'standards'
  },
  {
    n: '09',
    act: 2,
    kind: 'compare',
    height: 600,
    kicker: '둘째 마당 · 원칙',
    headline: '추측이 채우던 칸을\n[확인]으로 바꿉니다',
    mechanic: 'compare',
    caption:
      '비교 대상은 다른 곳의 상품이 아니라, 어제의 나입니다. 숫자는 리포트 구성 기준이며 차단 상태에서는 하지 않을 행동이 한 가지 더 붙습니다.'
  },
  {
    n: '10',
    act: 2,
    kind: 'deny',
    height: 480,
    kicker: '둘째 마당 · 원칙',
    headline: '운월당이\n[만들지 않는] 문장',
    body: '아래 네 가지는 재회운 리포트가 출력하지 않는 표현입니다. 결과를 만들 때 자동 점검으로 걸러지며, 걸리면 리포트를 발행하지 않습니다.',
    mechanic: 'deny'
  },
  {
    n: '11',
    act: 2,
    kind: 'safety',
    height: 780,
    kicker: '둘째 마당 · 원칙',
    headline: '여기서는 결과보다\n[안전]이 먼저입니다',
    note: '차단·연락 거절·위협이 있는 관계에서는 접촉보다 안전과 경계를 우선합니다. 이 경우 리포트는 연락 방법을 알려주는 대신, 지금 멈춰야 하는 이유와 다시 판단할 기준을 먼저 보여드립니다.',
    chapterFoot: '운월당 재회운 · 둘째 마당'
  },

  /* 셋째 마당 · 무엇을 계산하고, 무엇을 계산하지 않는가 */
  {
    n: '12',
    act: 3,
    kind: 'plate',
    height: 940,
    plate: { seal: '雲月堂', act: '셋째 마당', title: '결제하면 무엇이 열리는가' },
    headline: '결과에서 확인하는\n[다섯] 가지',
    mechanic: 'parts',
    body: '여기서부터는 실제 결과 화면의 형식을 그대로 보여드립니다. 값은 전부 예시 표기입니다.',
    caption:
      '계산 근거가 확인되지 않은 항목은 만들어 붙이지 않고, 근거가 없다는 사실을 그대로 표시합니다.'
  },
  {
    n: '13',
    act: 3,
    kind: 'panes',
    height: 810,
    kicker: '셋째 마당 · 근거',
    badge: '예시 화면',
    headline: '알려주신 상황과\n계산한 근거를 [섞지] 않습니다',
    mechanic: 'panes',
    body: '왼쪽은 알려주신 내용 그대로입니다. 오른쪽은 본인 생년월일에서 계산되는 항목이고, 이 둘을 한 문장으로 합치지 않습니다.',
    caption:
      '두 사람의 정보가 함께 들어가는 계산은 이 네 항목이 아니라 궁합 근거에서 따로 다루고, 결과에도 따로 표시합니다.'
  },
  {
    n: '14',
    act: 3,
    kind: 'sample',
    height: 620,
    kicker: '셋째 마당 · 근거',
    badge: '예시 화면',
    headline: '명식에서 나오는 건\n[네 줄]입니다',
    mechanic: 'myeongsik',
    body: '본인 일간, 원국 오행, 도움 오행, 현재 대운. 재회운이 사주 계산에서 직접 가져오는 사실은 이 네 줄이고, 나머지 해석은 이 네 줄 위에서만 만들어집니다.',
    caption: '표기 형식은 예시이며, 실제 값은 입력하신 정보로 계산됩니다.'
  },
  {
    n: '15',
    act: 3,
    kind: 'branch',
    height: 700,
    kicker: '셋째 마당 · 근거',
    headline: '답이 갈리는 지점은\n지금의 [연락 상태]입니다',
    mechanic: 'branch',
    body: '같은 명식이어도 여기서 고른 답에 따라 연락 조건·하지 않을 행동·시기 문장이 통째로 달라집니다. 같은 결과지를 모두에게 보내지 않습니다.',
    note: '상대방의 생년월일(가능하면 태어난 시간)이 필요합니다. 상대방이 제공했거나 서비스 이용에 동의한 정보만 입력해 주세요.',
    caption: '실제 판정은 입력하신 내용으로 리포트가 합니다.'
  },
  {
    n: '16',
    act: 3,
    kind: 'gauge',
    height: 470,
    kicker: '셋째 마당 · 근거',
    badge: '예시 화면',
    headline: '이 칸은\n[우리가] 채우지 않습니다',
    mechanic: 'gaugeTimeline',
    gaugeCaption:
      '연락해도 되는 조건은 항상 세 가지로 정리해 드립니다. 충족 여부는 상대의 실제 응답을 보고 당신이 채웁니다.',
    body: '대신 지금부터 할 일은 드립니다. 오늘 두 가지, 7일 안에 세 가지, 30일 안에 세 가지로 나눠 순서를 정합니다.'
  },
  {
    n: '17',
    act: 3,
    kind: 'window',
    height: 560,
    kicker: '셋째 마당 · 근거',
    badge: '예시 화면',
    headline: '시기는 [한 곳],\n날짜가 아니라 구간',
    mechanic: 'timingBand',
    bandNote: '명리 흐름을 검토할 참고 구간일 뿐, 연락 동의나 재회를 보장하는 날짜가 아닙니다.',
    tallyFoot: '* 리포트 구성 기준입니다. 이용자 수·후기 수 같은 실적 수치는 표기하지 않습니다.',
    chapterFoot: '운월당 재회운 · 셋째 마당'
  },

  /* 넷째 마당 · 어느 쪽이든 */
  {
    n: '18',
    act: 4,
    kind: 'plate',
    height: 530,
    plate: { seal: '雲月堂', act: '넷째 마당', title: '어느 쪽이든' },
    headline: '다시 이어져도,',
    body: '리포트 마지막에는 재회 뒤 같은 이별을 반복하지 않기 위한 지속 조건 네 가지가 붙습니다.',
    bubbles: [{ text: '다시 만나면,\n또 같을까.', side: 'left', top: '8%', i: 0 }]
  },
  {
    n: '19',
    act: 4,
    kind: 'safety',
    height: 790,
    headline: '각자의 길을 가도.',
    body: '정리도 결론입니다. 다시 만나는 것만 정답으로 몰지 않습니다. 결과의 목적은 상대를 붙잡게 하는 것이 아니라, 지금의 내가 후회가 적은 선택을 하도록 돕는 것입니다.',
    note: '차단·연락 거절·위협이 있는 관계에서는 접촉보다 안전과 경계를 우선합니다.',
    /* 마감선은 결제 관문(20) 아래가 아니라 서사가 닫히는 19 에 둔다. 네 마당 모두 닫힌다. */
    chapterFoot: '운월당 재회운 · 넷째 마당'
  },
  {
    n: '20',
    act: 4,
    kind: 'offer',
    height: 760,
    kicker: '넷째 마당 · 선택',
    headline: '추측을 한 번 더 하는 대신,\n내가 확인할 [기준]을 갖는 일',
    mechanic: 'gate'
  }
];
