/**
 * 재회운 리포트 · 8장 × 컷 조립 (명세 §1, §3, §5).
 *
 * 이 파일은 **결정론 경로만으로 완성되는 리포트**를 만든다.
 * 판정·집계·날짜·차트가 전부 결정론이므로 CH00~CH07 전 장이 제미나이 없이 성립한다.
 * 제미나이는 나중에 `bubbles[].text` / `narration` / `caption` 만 컷 id 로 매칭해 덮어쓴다.
 *
 * 화자는 **운월**. 존댓말, `{이름}님`. 장 제목은 독자의 1인칭 질문이다.
 * 반말 도발 화법과 화자 캐릭터는 참고 페이지에서 가져오지 않는다.
 */

import type { SajuReportData } from '../saju/report';
import { resolveReunionAgeBand, type ReunionAgeBand } from './ageBand';
import { getBandExpansionBlocks, isChapterExpandedByDefault } from './bandCopy';
import { getReunionBannedPhrases } from './bannedPhrases';
import {
  REUNION_PRECISION_ASYMMETRY_NOTE,
  REUNION_REDUCED_COMPATIBILITY_REASON,
  buildReunionCompatibilityAxes,
  findReunionContinuityAxis,
  getReunionCompatibilityConclusions
} from './compatibilityAxes';
import {
  REUNION_REFUSAL_SIGNAL_ID,
  REUNION_SELF_CHECK_QUESTIONS,
  allowReunionPurchaseCta,
  buildReunionGate,
  type ReunionSelfCheck
} from './gate';
import { buildReunionCheckpoints, buildReunionUnconfirmedCards, tallyReunionCheckpoints } from './checkpoints';
import { translateReunionTerm } from './glossary';
import { buildReunionContactReadiness } from './readiness';
import {
  REUNION_UNDELETABLE_COPY_IDS,
  formatReunionUndeletableCopy,
  type ReunionUndeletableCopyId
} from './safetyCopy';
import { REUNION_DEADLINE_WATCH_SIGNALS, REUNION_OBSERVABLE_SIGNALS } from './signalTable';
import {
  REUNION_RECORD_ONLY_TIMING_LABELS,
  REUNION_TIMING_LABELS,
  REUNION_YEAR_TIMING_LABELS,
  buildReunionCheckpointSuggestion,
  buildReunionTimeline,
  buildReunionYearTimeline
} from './timeline';
import type {
  ReunionAxisDirection,
  ReunionBubble,
  ReunionChapter,
  ReunionChapterId,
  ReunionChapterIndex,
  ReunionCut,
  ReunionCutLayout,
  ReunionCutMask,
  ReunionCutPayload,
  ReunionEvidenceBadge,
  ReunionGateVerdict,
  ReunionPillarCell,
  ReunionReportPayload,
  ReunionSceneKey
} from './reportTypes';
import { REUNION_BEAT_HEIGHTS, REUNION_REPORT_VERSION } from './reportTypes';
import type { ReunionContext } from './types';

/* ── 장 메타 ─────────────────────────────────────────────── */

interface ChapterMeta {
  id: ReunionChapterId;
  index: ReunionChapterIndex;
  questionTitle: string;
  subtitle: string;
  answeredQuestion: string;
  outline: readonly string[];
  footerNote: string;
}

const CHAPTER_META: readonly ChapterMeta[] = Object.freeze([
  {
    id: 'prologue',
    index: 0,
    questionTitle: '「제가 이상한 건가요?」',
    subtitle: '읽기 전에, 지금 상태부터 봅니다',
    answeredQuestion: '이걸 찾아보는 내가 이상한 건가요?',
    outline: [
      '지금 {name}님이 서 있는 자리',
      '이 리포트가 답하는 여섯 질문',
      '이 리포트가 답하지 않는 세 가지',
      '지금 판단해도 되는 상태인가'
    ],
    /* 무료 구간은 `/preview/love-reunion` 이 잠긴 섹션 제목 네 줄만 보여주는 별도 화면이다.
       이 리포트는 접근 게이트를 통과한 뒤에만 렌더되므로 '결제 없이 읽을 수 있다'는
       독자가 즉시 반증할 수 있는 문장이 된다. 참인 진술로만 적는다. */
    footerNote: '이 장은 결론을 내는 장이 아니에요. 오늘 상태부터 봅니다.'
  },
  {
    id: 'breakup-reason',
    index: 1,
    questionTitle: '「우리, 왜 헤어진 걸까요?」',
    subtitle: '이유를 하나로 좁히지 않습니다',
    answeredQuestion: '우리는 왜 헤어진 걸까요?',
    outline: [
      '내가 관계에서 반복하는 방식',
      '그때 내가 못 본 것',
      '이 이별은 어디에 속하나',
      '내 동기는 넷 중 어디에 가까운가'
    ],
    footerNote: '유형은 {name}님이 고르신 내용을 그대로 씁니다.'
  },
  {
    id: 'partner-state',
    index: 2,
    questionTitle: '「그 사람 마음은 지금 어떤가요?」',
    subtitle: '볼 수 없는 것과 계산된 것을 나눕니다',
    answeredQuestion: '그 사람 마음은 지금 어떤가요?',
    outline: [
      '솔직히 말씀드릴게요 — 마음은 볼 수 없어요',
      '대신 계산된 것: 두 명식이 지금 어떻게 맞물려 있나',
      '내가 본 것 · 이건 사실 · 이건 추측'
    ],
    footerNote: '이 장의 모든 문장은 계산된 구조에 대한 것이에요.'
  },
  {
    id: 'contact-readiness',
    index: 3,
    questionTitle: '「지금, 연락해도 될까요?」',
    subtitle: '날짜가 아니라 조건을 셉니다',
    answeredQuestion: '지금, 연락해도 될까요?',
    outline: [
      '지금 연락해도 되는 상태인가',
      '아직 확인되지 않은 조건',
      '연락한다면 무엇을 하지 않아야 하나',
      '연락 전에 정리해야 할 것'
    ],
    footerNote: '확률이 아니라 조건 개수예요.'
  },
  {
    id: 'twelve-months',
    index: 4,
    questionTitle: '「언제쯤이 괜찮을까요? 그리고 언제까지 기다려야 하나요?」',
    subtitle: '{name}님 쪽 흐름과, {name}님이 정하는 기한',
    answeredQuestion: '언제쯤이 괜찮고, 언제까지 기다려야 하나요?',
    outline: [
      '앞으로 12개월, 내 흐름은 어떻게 움직이나',
      '말문을 열기 유리한 구간과 그때의 조건',
      '이 시기표를 어떻게 읽어야 하나',
      '내가 정하는 판단 기한'
    ],
    footerNote: '날짜를 약속하는 표가 아니에요.'
  },
  {
    id: 'repeat-risk',
    index: 5,
    questionTitle: '「다시 만나면, 또 똑같아지지 않을까요?」',
    subtitle: '되돌아올 문제와, 그걸 막는 합의',
    answeredQuestion: '다시 만나면 또 똑같아지지 않을까요?',
    outline: [
      '다시 만났을 때 가장 먼저 되돌아올 문제',
      '그 문제가 다시 오는 조건',
      '이번에 달라지려면 무엇이 합의되어야 하나',
      '다시 만나면 안 되는 경우'
    ],
    footerNote: '사과보다 몇 주가 더 정확해요.'
  },
  {
    id: 'other-door',
    index: 6,
    questionTitle: '「재회가 아니면, 저는 어떻게 되나요?」',
    subtitle: '놓는 쪽도 같은 분량으로 씁니다',
    answeredQuestion: '재회가 아니면 저는 어떻게 되나요?',
    outline: [
      '이 관계를 놓았을 때 앞으로 흐름은',
      '내 상태가 열리는 구간은 언제인가',
      '그전에 정리해야 할 한 가지',
      '지금 제일 먼저 돌아올 일상'
    ],
    footerNote: '이 장은 앞 장과 같은 분량으로 씁니다. 놓는 쪽을 짧게 쓰지 않아요.'
  },
  {
    id: 'letter',
    index: 7,
    questionTitle: '「운월이 {name}님께」',
    subtitle: '그래서 오늘은 무엇을 하면 되나',
    answeredQuestion: '그래서 오늘 저는 뭘 하면 되나요?',
    outline: [
      '여섯 질문의 집계',
      '지금 확인되지 않은 것들',
      '처음에 물어보신 한 문장에 대한 답',
      '오늘 할 것 한 가지',
      '나의 판단 기록'
    ],
    footerNote: '리포트는 계정에 그대로 남아요.'
  }
]);

/* ── 컷 빌더 ─────────────────────────────────────────────── */

interface CutSpec {
  id: string;
  height: number;
  layout: ReunionCutLayout;
  sceneKey?: ReunionSceneKey | null;
  sceneAlt?: string;
  sceneScale?: number;
  bubbles?: readonly ReunionBubble[];
  narration?: string;
  caption?: string;
  evidenceBadges?: readonly ReunionEvidenceBadge[];
  payload?: ReunionCutPayload;
  mask?: ReunionCutMask;
  conditional?: { key: string; reason: string };
  undeletableCopyId?: ReunionUndeletableCopyId;
  bandBlockId?: string;
  copyExemption?: { reason: string };
}

function makeCut(chapterId: ReunionChapterId, order: number, spec: CutSpec): ReunionCut {
  return {
    id: spec.id,
    chapterId,
    order,
    height: spec.height,
    layout: spec.layout,
    sceneKey: spec.sceneKey ?? null,
    ...(spec.sceneAlt ? { sceneAlt: spec.sceneAlt } : {}),
    ...(spec.sceneScale ? { sceneScale: spec.sceneScale } : {}),
    bubbles: spec.bubbles || [],
    ...(spec.narration ? { narration: spec.narration } : {}),
    ...(spec.caption ? { caption: spec.caption } : {}),
    evidenceBadges: spec.evidenceBadges || [],
    ...(spec.payload ? { payload: spec.payload } : {}),
    mask: spec.mask || 'none',
    ...(spec.conditional ? { conditional: spec.conditional } : {}),
    ...(spec.undeletableCopyId ? { undeletable: true, undeletableCopyId: spec.undeletableCopyId } : {}),
    ...(spec.bandBlockId ? { bandBlockId: spec.bandBlockId } : {}),
    ...(spec.copyExemption ? { copyExemption: spec.copyExemption } : {})
  };
}

function beat(id: string, size: keyof typeof REUNION_BEAT_HEIGHTS): CutSpec {
  return { id, height: REUNION_BEAT_HEIGHTS[size], layout: 'beat' };
}

function bubble(
  text: string,
  position: ReunionBubble['position'],
  tone: ReunionBubble['tone'] = 'calm',
  kind: ReunionBubble['kind'] = 'speech'
): ReunionBubble {
  return { position, tone, text, kind };
}

/* ── 입력 ─────────────────────────────────────────────── */

export interface BuildReunionReportInput {
  report: SajuReportData;
  context: ReunionContext;
  /** 화면에서 부를 이름. 비면 리포트의 `customerName`, 그것도 비면 '그대'. */
  name?: string;
  /** 정규화된 **양력** 생년월일. 밴드 계산에만 쓰고 화면에 출력하지 않는다. */
  birthDate?: string | null;
  /** CH00 자가체크 3문항. 인테이크 배선 전에는 생략한다(하드 조건만으로 판정). */
  selfCheck?: ReunionSelfCheck | null;
  /**
   * CH02 신호 판독표에서 독자가 켠 항목. 화면 상태를 그대로 올려 받는다.
   *
   * 여기서 쓰는 것은 `refusal-stated` 한 칸뿐이다 — 나머지는 저장하지 않는 화면 표시이고,
   * 저장·집계하는 순간 §6-B 가 금지한 상대 관찰 트래커가 된다.
   */
  observedSignals?: Readonly<Record<string, boolean>> | null;
  /** 밴드를 바깥에서 고정할 때만 넘긴다. 없으면 생년월일 + `report.createdAt` 으로 계산한다. */
  ageBand?: ReunionAgeBand;
}

const BREAKUP_DURATION_LABELS: Record<ReunionContext['breakupDuration'], string> = {
  under1m: '1개월 미만',
  oneTo3m: '1~3개월',
  threeTo6m: '3~6개월',
  sixTo12m: '6~12개월',
  over1y: '1년 이상',
  unknown: '알 수 없음'
};

const CONTACT_STATUS_LABELS: Record<ReunionContext['contactStatus'], string> = {
  'no-contact': '연락 없음',
  occasional: '가끔 연락',
  active: '연락 지속 중',
  blocked: '연락·차단 경계 있음',
  unknown: '알 수 없음'
};

const DESIRED_OUTCOME_LABELS: Record<ReunionContext['desiredOutcome'], string> = {
  reconnect: '다시 연결하기',
  closure: '관계를 정리하기',
  clarity: '관계의 현재 상태를 확인하기',
  unsure: '아직 정하지 못함'
};

/**
 * `reportPresentation.ts:37-42` 의 4줄을 계량 서술로 다듬어 승계한다. 금지 자체는 완화하지 않는다.
 * 훈계형(`매달리지 마세요`)이 아니라 **무슨 일이 일어나는지**만 적는다(§6-E).
 */
const PROHIBITED_ACTIONS: readonly string[] = Object.freeze([
  '같은 내용을 두 번째 보내면 다음 대화를 여는 조건이 되돌아갑니다',
  '친구나 가족을 통해 반응을 확인하면 그 사람이 그은 경계가 한 겹 더 닫힙니다',
  '온라인 상태나 SNS 반응을 동의로 읽으면 사실 칸과 추측 칸이 섞입니다',
  '운세 결과를 근거로 답변이나 만남을 요구하면 대화가 아니라 압박이 됩니다'
]);

/**
 * 차단·연락 상태 미확인일 때 **목록 맨 앞에** 붙는 한 줄.
 * `reportPresentation.ts:56` 이 `blocked` 분기에서만 붙이던 항목이고,
 * 차단 상황에서 가장 직접적인 스토킹 방지 줄이라 분기째로 승계한다.
 */
const PROHIBITED_DETOUR_CONTACT =
  '다른 번호나 계정으로 우회 연락하면 상대가 표시한 경계를 지우는 행동이 됩니다';

/** CH07 에서 한 번 더 확인하는 경계 문장(§6-A, `viewModel.ts:263` 의 `contactBoundary`). */
const CONTACT_BOUNDARY_NOTE =
  '차단이나 연락 거부 신호가 있으면 우회 연락을 제안하지 않고 상대의 경계를 먼저 둡니다.';

function buildProhibitedActions(context: ReunionContext): readonly string[] {
  return context.contactStatus === 'blocked' || context.contactStatus === 'unknown'
    ? [PROHIBITED_DETOUR_CONTACT, ...PROHIBITED_ACTIONS]
    : PROHIBITED_ACTIONS;
}

/** 이 payload 종류는 금지어 검사에서 제외한다 — 금지 행동을 **금지하기 위해** 이름을 부르는 목록이다. */
export const REUNION_BANNED_CHECK_EXEMPT_PAYLOAD_KINDS: readonly string[] = Object.freeze(['prohibited']);

const BREAKUP_TYPE_CARDS: readonly string[] = Object.freeze([
  '현실 조건이 먼저 걸렸다',
  '서서히 식었다',
  '다른 사람이 있었다',
  '연락이 끊긴 채 끝났다'
]);

/**
 * 동기 4분면. 전부 **독자 자신**을 주어로 쓴다.
 *
 * 첫 항목을 '그 사람이 후회하는 …' 으로 쓰면 뜻은 독자의 동기라도
 * `reportBuilder.ts:145` 의 '상대 속마음 단정' 패턴(`(상대|그 사람)(은|는|이|가) …후회`)에
 * 문자열 그대로 걸린다. 검사는 문자열만 보므로 어형으로 피한다.
 */
const MOTIVE_QUADRANT: readonly string[] = Object.freeze([
  '내가 더 나아진 모습을 보여주고 싶다는 생각이 든다',
  '혼자 있는 저녁이 견디기 어렵다',
  '끝난 이유를 아직 한 문장으로 못 쓰겠다',
  '그때 못 한 말을 아직 들고 있다'
]);

/**
 * CH01 1-1 '내가 관계에서 반복하는 방식' — 상위 십성 하나에서 결정론으로 고른다.
 *
 * 고정 문장을 쓰면 모든 독자가 같은 성향 판정을 받고, 그 옆에 실제 계산값인 십성 배지가
 * 붙는 순간 **근거 없는 문장이 근거 있는 판정처럼** 보인다. 두 층이 반대를 말하는 경우도
 * 실제로 생긴다(정관·정인 상위 독자에게 '감정을 말로 먼저 꺼내는 쪽').
 *
 * 말풍선은 `REUNION_BUBBLE_SPEC` 규격(26자 / 4줄 / 줄당 11자) 안이고 명리 용어는 0개다.
 * 용어는 c01-6 의 배지에만 둔다 — 2층 분리 규칙.
 */
const SELF_PATTERN_BY_TEN_GOD: Readonly<Record<string, { bubble: string; caption: string }>> =
  Object.freeze({
    비견: {
      bubble: '내 기준을\n먼저 세우는\n쪽이에요.',
      caption: '관계에서도 내 기준을 먼저 세우는 쪽이었어요.'
    },
    겁재: {
      bubble: '나누다가도\n선을 다시 긋는\n쪽이에요.',
      caption: '함께 나누다가도 선을 다시 긋는 쪽이었어요.'
    },
    식신: {
      bubble: '표현하고\n돌보는 쪽이\n먼저 움직여요.',
      caption: '감정을 말로 먼저 꺼내는 쪽이었어요.'
    },
    상관: {
      bubble: '할 말을\n먼저 꺼내는\n쪽이에요.',
      caption: '직설이 먼저 나오는 쪽이었어요.'
    },
    편재: {
      bubble: '관계를 넓게\n벌려 두는\n쪽이에요.',
      caption: '관계를 넓게 벌려 두는 쪽이었어요.'
    },
    정재: {
      bubble: '정해 둔 것을\n지키려는 쪽이\n먼저예요.',
      caption: '정해 둔 것을 지키는 쪽이었어요.'
    },
    편관: {
      bubble: '멀어질 낌새를\n가장 먼저\n알아채는 쪽이에요.',
      caption: '압박이 오면 먼저 긴장하는 쪽이었어요.'
    },
    정관: {
      bubble: '규칙과 책임을\n먼저 보는\n쪽이에요.',
      caption: '규칙과 책임을 먼저 보는 쪽이었어요.'
    },
    편인: {
      bubble: '혼자 되짚는\n시간이 먼저\n오는 쪽이에요.',
      caption: '혼자 되짚는 시간이 먼저 오는 쪽이었어요.'
    },
    정인: {
      bubble: '기대고 회복하는\n쪽이 먼저\n움직여요.',
      caption: '기대어 회복하는 쪽이었어요.'
    }
  });

/** 상위 십성. 없으면 null — 그때는 성향 문장을 만들지 않는다. */
function topTenGodLabel(report: SajuReportData): string | null {
  const top = [...(report.tenGods || [])]
    .filter((item) => item.value > 0)
    .sort((left, right) => right.value - left.value)[0];
  return top?.label || null;
}

const SELF_PATTERN_WITHHELD = Object.freeze({
  bubble: '명식만으로\n단정하지\n않을게요.',
  caption: '상위 십성이 확정되지 않아 이 칸은 비워 둬요.'
});

function resolveSelfPattern(report: SajuReportData): { bubble: string; caption: string } {
  const label = topTenGodLabel(report);
  return (label && SELF_PATTERN_BY_TEN_GOD[label]) || SELF_PATTERN_WITHHELD;
}

/**
 * CH05 5-2 반복 지점 표. **'관계 지속과 회복' 축의 판정에서만** 나온다.
 *
 * 고정 문장으로 두면 좌열이 독자의 과거에 실제로 일어난 일을 사실처럼 단정하고
 * (`말이 길어지면 한쪽이 멈췄다`) 가운데 열이 재발을 단정한다(`다시 멈춥니다`).
 * 어느 쪽도 계산되지 않는다. 좌열은 계산된 판정만 적고, 가운데 열은 전부 조건문이다.
 * 근거가 없으면(`insufficient`) 표를 채우지 않고 보류라고 적는다.
 */
const REPEAT_ROWS_BY_DIRECTION: Readonly<
  Record<ReunionAxisDirection, readonly (readonly [string, string, string])[]>
> = Object.freeze({
  supportive: [
    [
      '지속과 회복 축이 순한 쪽으로 계산됐어요',
      '순한 축이어도 멈추는 방식이 정해져 있지 않으면 같은 자리가 다시 옵니다',
      '멈추기 전에 쉬는 시간을 먼저 정해요'
    ],
    [
      '되돌리는 힘이 있는 쪽으로 읽혀요',
      '되돌리는 힘만 믿으면 확인이 늦어질 때마다 의미가 다시 붙습니다',
      '확인 없이 넘길 시간을 정해 둬요'
    ]
  ],
  conditional: [
    [
      '지속과 회복 축은 조건을 함께 봐야 하는 쪽이에요',
      '조건이 비어 있으면 같은 자리에서 다시 멈출 수 있습니다',
      '멈추기 전에 쉬는 시간을 먼저 정해요'
    ],
    [
      '방향이 한쪽으로 기울지 않았어요',
      '기준이 없으면 확인이 늦어질 때마다 의미가 붙을 수 있습니다',
      '확인 없이 넘길 시간을 정해 둬요'
    ]
  ],
  tension: [
    [
      '지속과 회복 축이 부딪히는 쪽으로 계산됐어요',
      '그대로 두면 말이 길어지는 자리에서 다시 멈출 가능성이 큽니다',
      '멈추기 전에 쉬는 시간을 먼저 정해요'
    ],
    [
      '회복에 드는 시간이 길게 잡히는 쪽이에요',
      '회복 시간을 인정하지 않으면 확인이 늦을 때마다 의미가 붙습니다',
      '확인 없이 넘길 시간을 정해 둬요'
    ]
  ],
  insufficient: [
    [
      '지속과 회복 축은 근거가 부족해 판단을 보류했어요',
      '무엇이 되돌아올지는 계산으로 말하지 않을게요',
      '멈추기 전에 쉬는 시간을 먼저 정해요'
    ],
    [
      '상대의 태어난 시간이 확정되면 이 칸이 채워져요',
      '지금은 반복 여부를 단정하지 않습니다',
      '확인 없이 넘길 시간을 정해 둬요'
    ]
  ]
});

function buildPillarCells(report: SajuReportData): ReunionPillarCell[] {
  const order = ['시주', '일주', '월주', '년주'];
  return order
    .map((label) => report.visibleTenGods?.find((item) => item.pillar === label))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({
      pillar: item.pillar,
      stem: item.stem,
      branch: item.branch,
      stemHanja: item.stemHanja,
      branchHanja: item.branchHanja,
      stemTenGod: item.stemTenGod,
      branchTenGod: item.branchTenGod,
      branchMainStem: item.branchMainStem,
      isDayMaster: item.pillar === '일주'
    }));
}

/* ── 조립 ─────────────────────────────────────────────── */

export function buildReunionReportPayload(input: BuildReunionReportInput): ReunionReportPayload {
  const { report, context } = input;
  const name = (input.name || report.customerName || '').trim() || '그대';
  const referenceInstant = report.createdAt || null;
  const ageBand =
    input.ageBand ||
    resolveReunionAgeBand({ birthDate: input.birthDate, referenceInstant }).ageBand;

  const refusalObserved = Boolean(input.observedSignals?.[REUNION_REFUSAL_SIGNAL_ID]);

  const gate = buildReunionGate({ context, selfCheck: input.selfCheck, refusalObserved });
  const axes = buildReunionCompatibilityAxes(report);
  const conclusions = getReunionCompatibilityConclusions(report);
  const timeline = buildReunionTimeline(report);
  const yearCells = buildReunionYearTimeline(report);
  const readiness = buildReunionContactReadiness({
    context,
    report,
    axes,
    gate,
    referenceInstant,
    name,
    refusalObserved
  });
  const suggestion = buildReunionCheckpointSuggestion({ context, timeline, referenceInstant });
  const pillarCells = buildPillarCells(report);
  const checkpoints = buildReunionCheckpoints({
    context,
    gate,
    axes,
    readiness,
    timeline,
    yearCellCount: yearCells.length,
    hasNatalEvidence: pillarCells.length >= 3
  });
  const tally = tallyReunionCheckpoints(checkpoints);
  const unconfirmedCards = buildReunionUnconfirmedCards(checkpoints);

  const hasCompatibility = axes.some((axis) => axis.direction !== 'insufficient');
  const compatibilityReduced = hasCompatibility ? null : REUNION_REDUCED_COMPATIBILITY_REASON;
  const recordOnly = gate.state === 'deferred';
  const allowCta = allowReunionPurchaseCta(gate);
  const evidenceCount = report.engineMeta?.evidenceCount ?? 0;
  const userQuestion = (report.questionPreview || '').trim();
  const openCells = timeline.filter((cell) => cell.label === 'open');
  const holdCells = timeline.filter((cell) => cell.label === 'hold');
  const continuityAxis = findReunionContinuityAxis(axes);
  const selfPattern = resolveSelfPattern(report);
  const prohibitedActions = buildProhibitedActions(context);
  const boundaryNote =
    context.contactStatus === 'blocked' || context.contactStatus === 'unknown'
      ? CONTACT_BOUNDARY_NOTE
      : null;
  /* 학대 신호가 잡히면 CH06(놓는 쪽)을 먼저 펼치고 CH05 의 재회 조건 카드를 접는다(§6-D). */
  const harmSignal = gate.harmSignalDetected;
  /* '기록만' 모드에서는 12개월 표의 라벨을 시기 권유로 읽히지 않는 어휘로 바꾼다.
     이 컷은 삭제 불가 캡션을 싣고 있어 보류 판정에서도 접히지 않기 때문이다. */
  const timingLabels = recordOnly ? REUNION_RECORD_ONLY_TIMING_LABELS : REUNION_TIMING_LABELS;

  const undeletableCopy: Record<string, string> = {};
  REUNION_UNDELETABLE_COPY_IDS.forEach((id) => {
    undeletableCopy[id] = formatReunionUndeletableCopy(id, name);
  });

  const chapterSpecs: Record<ReunionChapterId, CutSpec[]> = {
    /* ── CH00 프롤로그 ───────────────────────────────── */
    prologue: [
      {
        id: 'c00-1',
        height: 560,
        layout: 'cinematic',
        narration: '늦은 밤에\n또 찾아보셨죠.'
      },
      {
        id: 'c00-2',
        height: 720,
        layout: 'cinematic',
        sceneKey: 'woman',
        sceneAlt: '어둠 속에서 조용히 이쪽을 보는 사람의 반신',
        sceneScale: 1.3,
        bubbles: [
          bubble('이상한 거 아니에요.', 'top-left', 'warm'),
          bubble('여기선\n아무도 안 봐요.', 'bottom-right', 'calm')
        ]
      },
      beat('c00-beat-1', 'beat-md'),
      {
        id: 'c00-3',
        height: 900,
        layout: 'panel',
        caption: `${name}님이 알려주신 것`,
        payload: {
          kind: 'input-echo',
          rows: [
            { label: '이별 후 기간', value: BREAKUP_DURATION_LABELS[context.breakupDuration], source: 'user' },
            { label: '현재 연락 상태', value: CONTACT_STATUS_LABELS[context.contactStatus], source: 'user' },
            { label: '마지막 연락', value: context.lastContactAt || '알려주지 않음', source: 'user' },
            { label: '이별 배경', value: context.breakupReason || '알려주지 않음', source: 'user' },
            { label: '원하는 결과', value: DESIRED_OUTCOME_LABELS[context.desiredOutcome], source: 'user' },
            { label: '가장 궁금한 것', value: userQuestion || '알려주지 않음', source: 'user' }
          ]
        }
      },
      {
        id: 'c00-4',
        height: 820,
        layout: 'checklist',
        caption: '세 줄만 확인할게요. 답은 저장되지 않아요.',
        payload: {
          kind: 'gate-check',
          questions: REUNION_SELF_CHECK_QUESTIONS.map((item) => ({ id: item.id, label: item.label })),
          answered: gate.selfCheckAnswered
        }
      },
      beat('c00-beat-2', 'beat-lg'),
      {
        id: 'c00-5',
        height: 700,
        layout: 'verdict',
        payload: {
          kind: 'gate-verdict',
          state: gate.state,
          reasons: gate.hardReasons,
          toc: CHAPTER_META.slice(1, 7).map((meta) => meta.answeredQuestion.replace(/\{name\}/gu, name))
        }
      },
      {
        /* §6-D. 상담 창구(`REUNION_SUPPORT_CONTACT`)가 확정되기 전에도 착지점은 있어야 한다.
           마지막 줄은 CH05 c05-7 의 3번째 줄과 같은 급의 안내다 — 보류 판정을 받은 독자에게
           CH05 는 접힌 장 안에 있으므로, 접히지 않는 이 컷에 같은 문장을 한 번 더 둔다. */
        id: 'c00-6',
        height: 480,
        layout: 'verdict',
        narration: '오늘은\n여기까지만\n읽으셔도 돼요.',
        caption:
          '나머지 장은 접어 둘게요. 내일 다시 열어도 그대로 있어요.\n혼자 판단하기 어려우면 믿을 만한 사람에게 상황을 그대로 말해 두세요.',
        conditional: { key: 'gate:deferred', reason: '판단 게이트가 보류로 나온 독자에게만 렌더한다.' }
      },
      {
        id: 'c00-7',
        height: 480,
        layout: 'panel',
        caption: `이 한 문장에 답하려고\n계산 근거 ${evidenceCount}건을 썼어요.`,
        payload: {
          kind: 'quote',
          text: userQuestion || '아직 한 문장으로 적지 못하셨어요.',
          note: '처음에 적으신 그대로예요.'
        }
      }
    ],

    /* ── CH01 ────────────────────────────────────────── */
    'breakup-reason': [
      { id: 'c01-1', height: 420, layout: 'panel' },
      {
        id: 'c01-2',
        height: 760,
        layout: 'cinematic',
        sceneKey: 'man',
        sceneAlt: '어둠 속에 등을 맞대고 선 두 사람의 실루엣',
        narration: '이유는 하나가\n아니었을 거예요.'
      },
      {
        id: 'c01-3',
        height: 1050,
        layout: 'panel',
        caption: '시·일·월·년 네 기둥이에요. 붉은 칸이 {name}님 자리예요.'.replace('{name}', name),
        payload: { kind: 'pillars', cells: pillarCells, tenGodBasisNote: report.tenGodBasisNote || '' }
      },
      {
        id: 'c01-4',
        height: 300,
        layout: 'panel',
        payload: {
          kind: 'facts4',
          rows: [
            { label: '본인 일간', value: `${report.dayMaster} · ${report.dayMasterElement}`, basis: 'calculated' },
            {
              label: '원국 오행',
              value: (report.fiveElements || []).map((item) => `${item.label} ${item.value}`).join(' · '),
              basis: 'calculated'
            },
            {
              label: '도움 오행',
              value: (report.helpfulElements || []).join(' · ') || '판단 보류',
              basis: 'calculated'
            },
            { label: '현재 흐름', value: report.currentDayun?.name || '자료 없음', basis: 'calculated' }
          ]
        }
      },
      {
        id: 'c01-5',
        height: 880,
        layout: 'mirror',
        bubbles: [bubble(selfPattern.bubble, 'top-left', 'calm')]
      },
      {
        /* 캡션과 배지는 **같은 상위 십성**에서 나온다. 두 층이 반대를 말하지 않는다. */
        id: 'c01-6',
        height: 480,
        layout: 'panel',
        caption: selfPattern.caption,
        evidenceBadges: buildTenGodBadges(report)
      },
      beat('c01-beat-1', 'beat-sm'),
      {
        id: 'c01-7',
        height: 700,
        layout: 'comparison',
        caption: `유형은 ${name}님이 고르신 내용을 그대로 씁니다.`,
        payload: {
          kind: 'checklist',
          items: BREAKUP_TYPE_CARDS.map((label, index) => ({ id: `breakup-type-${index}`, label }))
        }
      },
      {
        id: 'c01-8',
        height: 880,
        layout: 'checklist',
        caption: '고르신 뒤에 이름이 붙어요. 먼저 이름부터 보여드리지 않을게요.',
        payload: {
          kind: 'checklist',
          items: MOTIVE_QUADRANT.map((label, index) => ({ id: `motive-${index}`, label }))
        },
        ...(getBandExpansionBlocks(ageBand, 1).length > 0
          ? { bandBlockId: getBandExpansionBlocks(ageBand, 1)[0] }
          : {})
      },
      beat('c01-beat-2', 'beat-sm'),
      {
        id: 'c01-9',
        height: 700,
        layout: 'comparison',
        caption: '판정이 아니라 거울이에요. 부끄러운 동기는 없어요.',
        payload: {
          kind: 'compare2',
          left: {
            title: '이 동기로 가면',
            items: ['확인받고 싶은 마음이 먼저 움직여요', '상대의 반응이 하루의 기준이 돼요']
          },
          right: {
            title: '대신 이렇게 두면',
            items: ['확인할 것을 한 가지로 줄여요', '반응이 없어도 하루가 굴러가게 둬요']
          }
        }
      }
    ],

    /* ── CH02 ────────────────────────────────────────── */
    'partner-state': [
      {
        id: 'c02-1',
        height: 590,
        layout: 'cinematic',
        caption: undeletableCopy['partner-mind-locked'],
        undeletableCopyId: 'partner-mind-locked'
      },
      {
        id: 'c02-2',
        height: 680,
        layout: 'cinematic',
        sceneKey: 'hero',
        sceneAlt: '정면으로 눈을 마주 보는 운월',
        bubbles: [bubble('마음을 지어내면\n그 순간\n전부 거짓이 돼요.', 'bottom-left', 'direct')]
      },
      beat('c02-beat-1', 'beat-lg'),
      {
        id: 'c02-3',
        height: 1050,
        layout: 'comparison',
        mask: hasCompatibility ? 'partial' : 'none',
        caption: '방향만 표시해요. 점수로 바꾸지 않아요.',
        payload: {
          kind: 'axes',
          axes,
          precisionNote: hasCompatibility ? REUNION_PRECISION_ASYMMETRY_NOTE.replace('{name}', name) : null
        }
      },
      {
        id: 'c02-4',
        height: 760,
        layout: 'panel',
        mask: 'tail-blur',
        caption: conclusions[0] || '두 사람의 맞물림을 계산할 근거가 아직 부족해요.'
      },
      beat('c02-beat-2', 'beat-sm'),
      {
        id: 'c02-5',
        height: 880,
        layout: 'comparison',
        caption: '체크하면 사실 칸으로, 의미를 붙이면 추측 칸으로 갈려요.',
        payload: {
          kind: 'signal-table',
          items: REUNION_OBSERVABLE_SIGNALS.map((signal) => ({
            id: signal.id,
            label: signal.label,
            classification: 'fact' as const
          }))
        }
      },
      {
        id: 'c02-6',
        height: 480,
        layout: 'cinematic',
        bubbles: [bubble(`확인은 제가 아니라\n${name}님이 해요.`, 'bottom-right', 'calm')]
      }
    ],

    /* ── CH03 ────────────────────────────────────────── */
    'contact-readiness': [
      { id: 'c03-1', height: 420, layout: 'panel' },
      {
        id: 'c03-2',
        height: 750,
        layout: 'cinematic',
        sceneKey: 'phones',
        sceneAlt: '어두운 탁자 위 휴대폰 두 대. 화면 내용은 보이지 않는다',
        bubbles: [bubble('…', 'bottom-right', 'withholding', 'sfx')]
      },
      beat('c03-3', 'beat-md'),
      {
        id: 'c03-4',
        height: 880,
        layout: 'verdict',
        caption: undeletableCopy['readiness-not-probability'],
        undeletableCopyId: 'readiness-not-probability',
        payload: { kind: 'readiness', readiness }
      },
      {
        id: 'c03-5',
        height: 700,
        layout: 'checklist',
        mask: 'tail-blur',
        caption: '각 카드는 조건 · 지금 상태 · 채우는 방법 세 줄이에요.',
        payload: {
          kind: 'condition-cards',
          items: readiness.items.filter((item) => item.state !== 'met'),
          /* 조건이 전부 채워진 독자에게 '아직 확정되지 않았어요'를 띄우면
             바로 위 게이지('판단 보류 0')와 같은 컷 안에서 모순된다. */
          emptyLabel: '지금은 미확인 조건이 없어요.'
        }
      },
      beat('c03-beat-1', 'beat-md'),
      {
        id: 'c03-6',
        height: 760,
        layout: 'checklist',
        caption: '오늘 하지 않을 것',
        payload: { kind: 'prohibited', items: prohibitedActions }
      },
      {
        id: 'c03-7',
        height: 820,
        layout: 'panel',
        bubbles: [bubble('전부 말고,\n하나만요.', 'top-right', 'warm')],
        caption: recordOnly
          ? '오늘은 보내는 대신, 보내고 싶은 말을 적어 두는 것 하나만요.'
          : '돌려줄 물건, 함께 쓰던 계정, 남은 사진 중 하나만 먼저 정리하세요.'
      },
      {
        id: 'c03-8',
        height: 590,
        layout: 'verdict',
        caption: '지금은 보류가 답이에요. 이 판정은 어떤 계산으로도 뒤집지 않아요.',
        conditional: {
          key: 'contact:withheld',
          reason: '차단·미확인이거나 게이트가 보류일 때만 렌더하고, 이때 c03-4 게이지는 숨긴다.'
        }
      }
    ],

    /* ── CH04 ────────────────────────────────────────── */
    'twelve-months': [
      { id: 'c04-1', height: 420, layout: 'panel' },
      beat('c04-beat-1', 'beat-sm'),
      {
        id: 'c04-2',
        height: 1060,
        layout: 'chart',
        mask: 'partial',
        caption: undeletableCopy['timeline-not-probability'],
        undeletableCopyId: 'timeline-not-probability',
        payload: { kind: 'timeline12', cells: timeline, labels: timingLabels }
      },
      {
        /* '기록만' 모드에서는 구간을 강조하지 않는다. 접힌 장 안에서도 시기 권유가 나오면
           보류 판정이 한 번의 클릭으로 무력해진다(§6-C-3). */
        id: 'c04-3',
        height: 760,
        layout: 'chart',
        mask: 'partial',
        bubbles: [
          recordOnly
            ? bubble('오늘은 구간을\n고르지 않을게요.', 'top-left', 'calm')
            : bubble('이 구간이\n말문 열기엔 나아요.', 'top-left', 'calm')
        ],
        caption: recordOnly
          ? '보류로 나온 오늘은 유리한 구간을 따로 짚지 않아요. 표는 {name}님 흐름을 보는 용도로만 두세요.'.replace(
              '{name}',
              name
            )
          : openCells.length > 0
            ? `${openCells.map((cell) => `${cell.year}년 ${cell.month}월`).join(' · ')}`
            : '12개월 안에서 뚜렷하게 나은 구간이 갈리지 않았어요.'
      },
      {
        id: 'c04-4',
        height: 880,
        layout: 'checklist',
        caption: recordOnly
          ? '오늘은 조건 카드를 열지 않아요. 판단을 미루기로 한 상태에서는 연락 조건을 설계하지 않아요.'
          : '조건 없는 시기는 쓰지 않아요. 아래 조건은 구간과 상관없이 같아요.',
        payload: {
          kind: 'checklist',
          items: recordOnly
            ? []
            : (openCells[0]?.conditions || []).map((condition, index) => ({
                id: `open-condition-${index}`,
                label: `단, 이때도 ${condition}만요.`
              })),
          emptyLabel: recordOnly
            ? '오늘은 이 칸을 비워 둡니다.'
            : '12개월 안에서 조건을 붙일 구간이 갈리지 않았어요.'
        }
      },
      beat('c04-beat-2', 'beat-sm'),
      {
        id: 'c04-5',
        height: 700,
        layout: 'cinematic',
        sceneKey: 'moon',
        sceneAlt: '구름에 반쯤 가린 어두운 달',
        bubbles: [bubble('이때는 기다리는 게\n더 빨라요.', 'bottom-left', 'calm')],
        caption:
          holdCells.length > 0
            ? holdCells.map((cell) => `${cell.year}년 ${cell.month}월`).join(' · ')
            : '보류로 갈리는 구간은 없었어요.'
      },
      {
        id: 'c04-6',
        height: 620,
        layout: 'cinematic',
        sceneKey: 'hero',
        sceneAlt: '정면을 보는 운월',
        mask: 'none',
        bubbles: [bubble(undeletableCopy['timeline-not-promise'], 'top-right', 'direct')],
        undeletableCopyId: 'timeline-not-promise'
      },
      {
        id: 'c04-7',
        height: 820,
        layout: 'cinematic',
        sceneKey: 'knot',
        sceneAlt: '끝을 묶어 맺은 붉은 실',
        bubbles: [bubble('그런데,\n더 중요한 날짜가\n하나 있어요.', 'bottom-right', 'warm')]
      },
      beat('c04-beat-3', 'beat-lg'),
      {
        /* 삭제 불가 문구 `deadline-owner` 는 §6-F 가 '독자 입력 후에만'으로 못박았다.
           입력 전에 붙이면 화면의 유일한 날짜인 서버 제안 구간을 독자가 정한 것처럼 귀속시킨다.
           렌더러가 입력 유무로 이 캡션과 `deadlineBeforeInput` 을 갈라 그린다. */
        id: 'c04-8',
        height: 974,
        layout: 'input',
        mask: 'partial',
        caption: undeletableCopy['deadline-owner'],
        undeletableCopyId: 'deadline-owner',
        payload: {
          kind: 'deadline-input',
          /* '기록만' 모드에서는 시기 제안을 내지 않는다. 날짜 칸은 남긴다 — 적어 두는 것이 이 모드다. */
          suggestion:
            suggestion && !recordOnly
              ? { ...suggestion, rationale: suggestion.rationale.replace(/\{name\}/gu, name) }
              : null,
          storageKey: 'unwoldang.reunion.deadline',
          beforeInputNote: recordOnly
            ? '오늘은 제안 구간을 내지 않아요. 날짜는 다시 판단하고 싶은 날로 직접 적어 두세요.'
            : `날짜는 ${name}님이 직접 정하세요. 아래 구간은 제안일 뿐이에요.`
        }
      },
      {
        id: 'c04-9',
        height: 880,
        layout: 'checklist',
        caption: recordOnly
          ? '오늘은 적어 두기만 해요. 확인은 다시 판단하기로 한 날에 해요.'
          : '그날까지 확인할 것은 이 세 가지예요.',
        payload: {
          kind: 'checklist',
          items: REUNION_DEADLINE_WATCH_SIGNALS.map((label, index) => ({
            id: `watch-${index}`,
            label
          }))
        }
      },
      {
        id: 'c04-10',
        height: 820,
        layout: 'comparison',
        bubbles: [bubble(`어느 쪽이든\n고르는 건\n${name}님이에요.`, 'bottom-left', 'calm')],
        payload: {
          kind: 'compare2',
          left: { title: '계속 본다', items: ['정한 날까지 신호만 적어 둬요'] },
          right: { title: '놓는다', items: ['정한 날에 이 리포트를 다시 열어요'] }
        }
      },
      {
        id: 'c04-11',
        height: 480,
        layout: 'panel',
        caption: '다음 장에서는 다시 만났을 때 되돌아오는 문제를 봐요.'
      }
    ],

    /* ── CH05 ────────────────────────────────────────── */
    'repeat-risk': [
      { id: 'c05-1', height: 420, layout: 'panel' },
      {
        id: 'c05-2',
        height: 820,
        layout: 'cinematic',
        sceneKey: 'thread',
        sceneAlt: '끊어진 자리를 다시 이어 붙인 붉은 실의 클로즈업',
        narration: '붙일 수는 있어요.\n어디가 금이었는지는\n남고요.'
      },
      beat('c05-beat-1', 'beat-md'),
      {
        /* 좌열은 **계산된 지점**이고, 가운데 열은 그 판정에 맞춘 조건문이다.
           과거에 무슨 일이 있었는지는 계산 근거가 없으므로 단정하지 않고,
           재발도 단정하지 않는다. 표의 근거는 '관계 지속과 회복' 축 하나뿐이다. */
        id: 'c05-3',
        height: 900,
        layout: 'comparison',
        caption: continuityAxis?.statement || REUNION_REDUCED_COMPATIBILITY_REASON,
        payload: {
          kind: 'compare3',
          headers: ['계산된 지점', '합의가 없으면', '달라지려면'],
          rows: REPEAT_ROWS_BY_DIRECTION[continuityAxis?.direction || 'insufficient']
        }
      },
      {
        id: 'c05-4',
        height: 880,
        layout: 'checklist',
        caption: harmSignal
          ? '통제·모욕·위협이 반복된 관계에서는 합의 조건을 먼저 세우지 않아요. 이 칸은 접어 둘게요.'
          : recordOnly
            ? '오늘은 합의가 아니라 적어 두는 칸이에요. 상대에게 꺼내는 것은 판단을 다시 여는 날에요.'
            : '그대로 상대에게 말할 수 있을 만큼 구체적이어야 해요.',
        payload: {
          kind: 'checklist',
          /* §6-D. 학대 신호가 잡히면 재회 조건 카드를 접는다. 안전이 합의보다 먼저다. */
          items: harmSignal
            ? []
            : [
                { id: 'agree-frequency', label: '연락 빈도를 숫자로 정한다' },
                { id: 'agree-pause', label: '갈등이 커질 때 멈추는 방식을 정한다' },
                { id: 'agree-alone', label: '각자의 시간을 침범하지 않는 선을 정한다' },
                { id: 'agree-cause', label: '이별 원인을 한 문장으로 합의한다' }
              ],
          emptyLabel: '안전한 거리가 먼저예요. 아래 기준 컷을 먼저 읽어 주세요.'
        }
      },
      {
        id: 'c05-5',
        height: 700,
        layout: 'panel',
        bubbles:
          getBandExpansionBlocks(ageBand, 5).includes('not-only-for-them')
            ? [bubble('그 사람 기준으로만\n정하지 마세요.', 'top-left', 'direct')]
            : [bubble('정하는 기준은\n하나면 돼요.', 'top-left', 'calm')],
        caption: getBandExpansionBlocks(ageBand, 5).includes('not-only-for-them')
          ? '이 결정에 영향을 받는 사람이 있다면, 그 사실을 기준에 함께 두세요.'
          : '합의 조건 중 가장 먼저 무너질 것 하나만 골라 두세요.',
        ...(getBandExpansionBlocks(ageBand, 5).includes('not-only-for-them')
          ? { bandBlockId: 'not-only-for-them' }
          : {})
      },
      {
        id: 'c05-6',
        height: 560,
        layout: 'cinematic',
        narration: '사과보다\n몇 주가\n더 정확해요.'
      },
      {
        id: 'c05-7',
        height: 590,
        layout: 'panel',
        sceneKey: 'woman',
        sceneAlt: '달을 등지고 조용히 돌아보는 사람',
        mask: 'none',
        caption: undeletableCopy['safety-boundary'],
        undeletableCopyId: 'safety-boundary'
      }
    ],

    /* ── CH06 ────────────────────────────────────────── */
    'other-door': [
      { id: 'c06-1', height: 420, layout: 'panel' },
      {
        id: 'c06-2',
        height: 820,
        layout: 'cinematic',
        sceneKey: 'moveOn',
        sceneAlt: '실 한 가닥을 쥔 채 혼자 걸어가는 뒷모습',
        narration: '다른 문 얘기,\n짧게만 할게요.'
      },
      beat('c06-beat-1', 'beat-md'),
      {
        id: 'c06-3',
        height: 900,
        layout: 'timeline',
        caption: `누가 나타나는 시점이 아니라, ${name}님 쪽 여력이 바뀌는 지점이에요.`,
        payload: { kind: 'timelineYears', cells: yearCells, labels: REUNION_YEAR_TIMING_LABELS }
      },
      {
        id: 'c06-4',
        height: 880,
        layout: 'checklist',
        caption: '하나를 정리하고, 하나를 되돌려 놓는 거예요.',
        payload: {
          kind: 'checklist',
          items: [
            { id: 'clear-one', label: '돌려주거나 돌려받을 것 하나를 이번 주에 끝낸다' },
            { id: 'restore-one', label: '잠드는 시간을 먼저 원래대로 돌린다' }
          ]
        }
      },
      {
        id: 'c06-5',
        height: 700,
        layout: 'checklist',
        caption: '전부 이 관계 바깥의 일이에요.',
        payload: {
          kind: 'checklist',
          items: [
            { id: 'daily-sleep', label: '자는 시간을 한 시간 앞당긴다' },
            { id: 'daily-work', label: '미뤄 둔 일 하나를 끝낸다' },
            { id: 'daily-money', label: '이번 달 지출을 한 번 본다' },
            { id: 'daily-people', label: '이 관계와 무관한 사람을 한 명 만난다' }
          ]
        }
      },
      {
        id: 'c06-6',
        height: 560,
        layout: 'cinematic',
        narration: '더 좋은 사람이\n온다는 말은\n하지 않을게요.',
        copyExemption: {
          reason:
            '§6-G. 금지어를 피하는 대신 금지어를 쓰지 않는다는 사실 자체를 대사로 만든 유일한 컷이다. 부정문이므로 금지어 검사에서 제외한다.'
        }
      },
      {
        id: 'c06-7',
        height: 590,
        layout: 'panel',
        narration: `대신,\n지금 ${name}님에게\n남아 있는 것을\n적어 드릴게요.`,
        payload: {
          kind: 'checklist',
          items: (report.keyTakeaways || []).slice(0, 3).map((card, index) => ({
            id: `remaining-${index}`,
            label: card.title
          }))
        }
      }
    ],

    /* ── CH07 에필로그 ──────────────────────────────── */
    letter: [
      {
        id: 'c07-1',
        height: 900,
        layout: 'verdict',
        caption: `여섯 질문 중 지금 확인된 것 ${tally.confirmed}개, 아직 확인할 수 없는 것 ${
          tally.unconfirmed + tally.deferred
        }개`,
        payload: { kind: 'tally', ...tally, items: checkpoints }
      },
      {
        id: 'c07-2',
        height: 720,
        layout: 'comparison',
        caption: '모르는 것을 모른다고 적어 둔 칸이에요.',
        payload: { kind: 'unconfirmed', items: unconfirmedCards }
      },
      beat('c07-beat-1', 'beat-lg'),
      {
        id: 'c07-3',
        height: 760,
        layout: 'cinematic',
        sceneKey: 'letter',
        sceneAlt: '봉랍이 찍힌 편지가 놓인 책상 앞에 앉아 있는 운월',
        payload: {
          kind: 'quote',
          text: userQuestion || '아직 한 문장으로 적지 못하셨어요.',
          note: '처음에 물어보신 문장이에요.'
        }
      },
      {
        id: 'c07-4',
        height: 880,
        layout: 'letter',
        payload: {
          kind: 'letter',
          lines: buildLetterLines(name, gate.state === 'deferred'),
          signature: '운월'
        }
      },
      {
        id: 'c07-5',
        height: 640,
        layout: 'input',
        caption: '한 줄만 적어 두세요. 그날 다시 열면 그대로 있어요.',
        payload: {
          kind: 'decision-input',
          storageKey: 'unwoldang.reunion.decision',
          deadlineStorageKey: 'unwoldang.reunion.deadline'
        }
      },
      {
        id: 'c07-6',
        height: 540,
        layout: 'panel',
        mask: 'none',
        caption: recordOnly
          ? '오늘 할 것은 하나예요. 오늘 있었던 일을 세 줄로 적어 두기.'
          : '오늘 할 것은 하나예요. 보내고 싶은 말을 적어 두고 오늘은 보내지 않기.',
        narration: '이상한 거 아니에요.',
        undeletableCopyId: 'legal-notice',
        payload: {
          kind: 'legal',
          lines: undeletableCopy['legal-notice'].split('\n'),
          serialNumber: report.serialNumber || '',
          issuedAt: report.createdAt || '',
          /* §6-A. 차단·미확인 분기를 CH07 에서 한 번 더 확인한다. */
          boundaryNote
        }
      }
    ]
  };

  const chapters: ReunionChapter[] = CHAPTER_META.map((meta, order) => {
    const specs = chapterSpecs[meta.id].filter((spec) => keepCut(spec, { gate, context }));
    const cuts = specs.map((spec, index) => makeCut(meta.id, index, spec));
    return {
      id: meta.id,
      index: meta.index,
      order,
      questionTitle: meta.questionTitle.replace(/\{name\}/gu, name),
      subtitle: meta.subtitle.replace(/\{name\}/gu, name),
      answeredQuestion: meta.answeredQuestion.replace(/\{name\}/gu, name),
      outline: meta.outline.map((line) => line.replace(/\{name\}/gu, name)),
      cuts,
      totalHeight: cuts.reduce((sum, cut) => sum + cut.height, 0),
      /* §6-D. 학대 신호가 잡히면 CH06(놓는 쪽)을 먼저 펼친다. 밴드 설정보다 우선한다. */
      expandedByDefault:
        harmSignal && meta.id === 'other-door' ? true : isChapterExpandedByDefault(ageBand, meta.index),
      reducedReason: meta.index === 2 || meta.index === 5 ? compatibilityReduced : null,
      allowPurchaseCta: allowCta,
      footerNote: meta.footerNote.replace(/\{name\}/gu, name)
    };
  });

  return {
    version: REUNION_REPORT_VERSION,
    ageBand,
    gate,
    chapters,
    checkpoints,
    cutIds: chapters.flatMap((chapter) => chapter.cuts.map((cut) => cut.id)),
    bannedPhrases: getReunionBannedPhrases(ageBand),
    undeletableCopy,
    allowPurchaseCta: allowCta
  };
}

/** 조건부 컷 판정. 조건 불충족이면 컷 자체가 배열에 없다. */
function keepCut(
  spec: CutSpec,
  state: { gate: ReunionGateVerdict; context: ReunionContext }
): boolean {
  if (!spec.conditional) return true;
  if (spec.conditional.key === 'gate:deferred') return state.gate.state === 'deferred';
  if (spec.conditional.key === 'contact:withheld') {
    return state.gate.state === 'deferred' || state.context.contactStatus === 'blocked';
  }
  return true;
}

/**
 * ◆근거 배지. 컷 대사와 **한 문장에 섞지 않는다** — 이것이 2층 분리 규칙의 전부다.
 * 번역은 `glossary.ts` 한 곳에서만 온다. 사전을 두 벌 만들지 않는다.
 */
function buildTenGodBadges(report: SajuReportData): ReunionEvidenceBadge[] {
  return [...(report.tenGods || [])]
    .filter((item) => item.value > 0)
    .sort((left, right) => right.value - left.value)
    .slice(0, 2)
    .map((item): ReunionEvidenceBadge | null => {
      const translation = translateReunionTerm(item.label);
      if (!translation) return null;
      return { term: item.label, translation, claimRefs: [`report:tenGods:${item.label}`] };
    })
    .filter((badge): badge is ReunionEvidenceBadge => badge !== null);
}

function buildLetterLines(name: string, deferred: boolean): readonly string[] {
  if (deferred) {
    return [
      `${name}님, 오늘은 결론을 내는 날이 아니에요.`,
      '여기까지 읽으신 것만으로 충분히 하신 거예요.',
      '잠과 끼니가 돌아오면 같은 질문도 다르게 보여요.',
      '그때 다시 열어 주세요. 리포트는 그대로 있어요.',
      '무엇을 고르셔도 제가 판단하지 않을게요.'
    ];
  }
  return [
    `${name}님, 이 리포트는 답을 정해 드리려고 쓰지 않았어요.`,
    '확인된 것과 아직 모르는 것을 나눠 드리려고 썼어요.',
    '기대가 아니라 행동을 기준으로 다음 한 걸음만 정하시면 돼요.',
    '다시 만나는 쪽도, 멈추는 쪽도 틀린 답이 아니에요.',
    `어느 쪽이든 고르는 사람은 저나 계산이 아니라 ${name}님이에요.`
  ];
}
