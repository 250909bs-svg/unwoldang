/**
 * 재회운 리포트 · 8장 × 컷 데이터 구조 (명세 §5).
 *
 * 이 파일에는 **타입과 상수만** 둔다. 계산은 각 builder 파일에 있다.
 *
 * 계약:
 * - 컷 id(`c04-8` 형태)는 결정론 base 가 독점적으로 정한다. 모델이 정하게 두지 않는다.
 * - 판정값(state, 조건 개수, 날짜, sceneKey, layout, chapterId, cutId)은 전부 결정론이다.
 *   제미나이가 덮어쓸 수 있는 것은 `bubbles[].text` / `narration` / `caption` 뿐이다.
 * - `beat` 컷은 `beatSize` 만 보고 높이를 정한다. 내용 없음, 순검정.
 * - `mask: 'none'` + `undeletable: true` 컷은 **어떤 결제 상태에서도 가리지 않는다.**
 */

import type { ReunionAgeBand } from './ageBand';
import type { ReunionUndeletableCopyId } from './safetyCopy';

export const REUNION_REPORT_VERSION = 'reunion-report-v1' as const;

export const REUNION_CHAPTER_IDS = [
  'prologue',
  'breakup-reason',
  'partner-state',
  'contact-readiness',
  'twelve-months',
  'repeat-risk',
  'other-door',
  'letter'
] as const;

export type ReunionChapterId = (typeof REUNION_CHAPTER_IDS)[number];

/** CH00~CH07 의 숫자 인덱스. 밴드 테이블의 `chapter` 키와 같은 축이다. */
export type ReunionChapterIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * 삽화 키. `src/features/reunion/reunionPanelAssets.ts` 의 `ReunionPanelKey` 와
 * **정확히 같은 집합**이어야 한다(`reportTypes.contract.test.ts` 가 잠근다).
 *
 * lib 가 features 를 import 하지 않기 위해 여기서 다시 선언한다.
 * `src/features/reunion/assets.ts` 는 계약 테스트가 키 목록을 정확 비교하므로 건드리지 않는다.
 */
export const REUNION_SCENE_KEYS = [
  'hero',
  'man',
  'woman',
  'thread',
  'moon',
  'dawn',
  'hands',
  'gate',
  'phones',
  'letter',
  'knot',
  'reflect',
  'reflectClose',
  'moveOn',
  'moveOnClose'
] as const;

export type ReunionSceneKey = (typeof REUNION_SCENE_KEYS)[number];

export type ReunionCutLayout =
  /** 전면 이미지 + 오버플로우 크롭 */
  | 'cinematic'
  /** 좌 화자 / 우 독자 자리 */
  | 'mirror'
  /** 금테 프레임 표·그리드 */
  | 'panel'
  /** 세로 타임라인 */
  | 'timeline'
  /** 12칸 막대 / 연운 곡선 */
  | 'chart'
  /** 체크박스 */
  | 'checklist'
  /** 2열 대조 */
  | 'comparison'
  /** 게이지·집계 카드 */
  | 'verdict'
  /** 독자 기입 */
  | 'input'
  /** 크림 지면 */
  | 'letter'
  /** 침묵 */
  | 'beat';

/** 120 / 240 / 360px */
export type ReunionBeatSize = 'beat-sm' | 'beat-md' | 'beat-lg';

export const REUNION_BEAT_HEIGHTS: Readonly<Record<ReunionBeatSize, number>> = Object.freeze({
  'beat-sm': 120,
  'beat-md': 240,
  'beat-lg': 360
});

export type ReunionBubblePosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type ReunionBubbleTone = 'calm' | 'direct' | 'warm' | 'withholding';

export interface ReunionBubble {
  position: ReunionBubblePosition;
  tone: ReunionBubbleTone;
  /** 줄바꿈은 `\n` 으로 데이터에 직접 들어온다. 렌더러는 `white-space: pre-line`. */
  text: string;
  /** 'speech' 꼬리 있음 / 'thought' 꼬리 없음 / 'sfx' 반투명 타원 */
  kind: 'speech' | 'thought' | 'sfx';
}

export interface ReunionEvidenceBadge {
  /** `REUNION_TERM_GLOSSARY` 의 키 */
  term: string;
  /** 한 줄 번역. 컷 대사와 절대 같은 문장에 섞지 않는다. */
  translation: string;
  claimRefs: readonly string[];
}

/** 무료 구간 마스킹. 'none' 컷은 결제 전에도 절대 가리지 않는다. */
export type ReunionCutMask = 'none' | 'tail-blur' | 'partial' | 'locked';

/* ── 컷 payload ─────────────────────────────────────────────── */

export interface ReunionInputEchoRow {
  label: string;
  value: string;
  /** 전부 'user'. ◇ 기호로 그린다. 계산값(◆)과 섞지 않는다. */
  source: 'user';
}

export interface ReunionPillarCell {
  /** '년' | '월' | '일' | '시' */
  pillar: string;
  stem: string;
  branch: string;
  stemHanja: string;
  branchHanja: string;
  stemTenGod: string;
  branchTenGod: string;
  branchMainStem: string;
  /** 일주 칸만 true. 붉게 + '나' 배지. */
  isDayMaster: boolean;
}

export interface ReunionElementCount {
  label: string;
  value: number;
  color: string;
}

export type ReunionAxisDirection = 'supportive' | 'conditional' | 'tension' | 'insufficient';

export interface ReunionCompatibilityAxis {
  id: string;
  /** 엔진 라벨 그대로. '초기 끌림과 반응성' 등. */
  label: string;
  direction: ReunionAxisDirection;
  /** 화면 표기. '순함 / 조건부 / 부딪힘 / 근거부족'. 영문 식별자를 화면에 쓰지 않는다. */
  directionLabel: string;
  /** ↗ → ↘ ? — %가 아니라 방향 아이콘 3단계 + 근거부족 */
  directionIcon: '↗' | '→' | '↘' | '?';
  statement: string;
  /** '근거 신뢰도' 라벨. 관계 점수와 색·크기를 완전히 분리해 그린다. */
  evidenceConfidenceLabel: string;
  /** 판단을 보류한 사유. 있으면 회색 빗금 + 이 문장. */
  withheldReason: string | null;
}

export interface ReunionSignalItem {
  id: string;
  label: string;
  /** 독자가 체크하기 전에는 미분류. 체크하면 fact, 해석을 덧붙이면 guess. */
  classification: 'fact' | 'guess';
}

export type ReunionReadinessState = 'met' | 'unmet' | 'unknown';

export interface ReunionReadinessItem {
  id: 'no-refusal' | 'interval' | 'elapsed' | 'month-window' | 'expression-axis';
  label: string;
  state: ReunionReadinessState;
  /** 지금 상태 한 줄. */
  reason: string;
  /** 채우는 방법 한 줄. */
  howToFill: string;
  /** 'input' = 사용자가 알려준 것(◇) / 'calculated' = 계산한 것(◆) */
  basis: 'input' | 'calculated';
}

export interface ReunionReadiness {
  met: number;
  unmet: number;
  unknown: number;
  items: readonly ReunionReadinessItem[];
  /** gate 가 deferred 이거나 차단이면 게이지 자체를 렌더하지 않고 '판정 보류' 카드로 대체한다. */
  withheld: boolean;
  withheldReason: string | null;
}

/** 말문 열기 유리 / 평상 / 보류 */
export type ReunionTimingLabel = 'open' | 'normal' | 'hold';

export interface ReunionTimelineCell {
  year: number;
  month: number;
  ganzhi: string;
  score: number;
  label: ReunionTimingLabel;
  validFrom: string | null;
  validTo: string | null;
  focus: string;
  warning: string;
  /**
   * `open` 셀에만 붙는 관찰 가능한 조건 2~3개.
   * 항목은 CH02 판독표의 '사실' 칸에서만 가져온다. 조건 없는 시기는 렌더하지 않는다.
   */
  conditions: readonly string[];
}

export interface ReunionYearCell {
  year: number;
  ganzhi: string;
  score: number;
  label: ReunionTimingLabel;
  summary: string;
  focus: string;
}

export interface ReunionCheckpointSuggestion {
  fromISO: string;
  toISO: string;
  /** 왜 이 범위인지 한 줄. 날짜를 대신 정하지 않는다는 사실을 포함한다. */
  rationale: string;
  /** 화면 표기용. '2026년 3월 ~ 2026년 5월' */
  label: string;
}

export type ReunionCheckpointState = 'confirmed' | 'unconfirmed' | 'deferred';

export interface ReunionCheckpoint {
  id: string;
  chapter: ReunionChapterIndex;
  /** CH00 목차에 실리는 '답하는 질문' 한 줄. */
  question: string;
  state: ReunionCheckpointState;
  /** 'unconfirmed' / 'deferred' 일 때 왜 확인할 수 없는지. 'confirmed' 면 null. */
  why: string | null;
}

export type ReunionCutPayload =
  | { kind: 'input-echo'; rows: readonly ReunionInputEchoRow[] }
  | { kind: 'gate-check'; questions: readonly { id: string; label: string }[]; answered: boolean }
  | { kind: 'gate-verdict'; state: 'ok' | 'deferred'; reasons: readonly string[]; toc: readonly string[] }
  | { kind: 'pillars'; cells: readonly ReunionPillarCell[]; tenGodBasisNote: string }
  | {
      kind: 'facts4';
      rows: readonly { label: string; value: string; basis: 'input' | 'calculated' }[];
    }
  | { kind: 'elements'; items: readonly ReunionElementCount[]; emptiest: string | null }
  | { kind: 'axes'; axes: readonly ReunionCompatibilityAxis[]; precisionNote: string | null }
  | { kind: 'signal-table'; items: readonly ReunionSignalItem[] }
  | { kind: 'readiness'; readiness: ReunionReadiness }
  /**
   * 두 차트 payload 는 **라벨 어휘를 함께 싣는다.** 렌더러가 전역 상수 하나를 쓰면
   * '기록만' 모드의 12개월 표와 CH06 연운이 둘 다 `말문 열기 나음` 을 달게 되는데,
   * 전자는 보류 판정을 무력화하고 후자는 자기 장의 캡션과 어긋난다.
   */
  | {
      kind: 'timeline12';
      cells: readonly ReunionTimelineCell[];
      labels: Readonly<Record<ReunionTimingLabel, string>>;
    }
  | {
      kind: 'timelineYears';
      cells: readonly ReunionYearCell[];
      labels: Readonly<Record<ReunionTimingLabel, string>>;
    }
  | {
      kind: 'deadline-input';
      suggestion: ReunionCheckpointSuggestion | null;
      storageKey: string;
      /**
       * 독자가 날짜를 쓰기 **전에** 캡션 자리에 들어가는 안내.
       * 삭제 불가 문구 `deadline-owner`(`{이름}님이 정한 점검일이에요.`)는 §6-F 대로
       * 입력이 채워진 뒤에만 나간다 — 그 전에는 서버 제안을 독자 것으로 귀속시키게 된다.
       */
      beforeInputNote: string;
    }
  | { kind: 'decision-input'; storageKey: string; deadlineStorageKey: string }
  | {
      kind: 'checklist';
      items: readonly { id: string; label: string }[];
      /** 항목이 0개일 때 쓰는 문장. 비면 렌더러의 기본 문구('아직 확정되지 않았어요')가 나간다. */
      emptyLabel?: string;
    }
  /**
   * CH03 3-2 미확인 조건 카드. `조건 · 지금 상태 · 채우는 방법` 세 줄을 그대로 싣는다.
   * `checklist` 로 보내면 라벨 한 줄만 남아 캡션이 약속한 세 줄이 렌더되지 않고,
   * 체크박스가 되면 집계에 반영되지 않는 토글이 생긴다.
   */
  | {
      kind: 'condition-cards';
      items: readonly ReunionReadinessItem[];
      /** 미확인 조건이 0개일 때 쓰는 문장. '아직 확정되지 않았다'와 뜻이 다르다. */
      emptyLabel: string;
    }
  | {
      kind: 'compare2';
      left: { title: string; items: readonly string[] };
      right: { title: string; items: readonly string[] };
    }
  | {
      kind: 'compare3';
      headers: readonly [string, string, string];
      rows: readonly (readonly [string, string, string])[];
    }
  | { kind: 'prohibited'; items: readonly string[] }
  | {
      kind: 'tally';
      confirmed: number;
      unconfirmed: number;
      deferred: number;
      items: readonly ReunionCheckpoint[];
    }
  | { kind: 'unconfirmed'; items: readonly { label: string; why: string }[] }
  | { kind: 'quote'; text: string; note: string }
  | { kind: 'letter'; lines: readonly string[]; signature: string }
  | {
      kind: 'legal';
      lines: readonly string[];
      serialNumber: string;
      issuedAt: string;
      /**
       * 차단·미확인 독자에게 CH07 에서 한 번 더 확인하는 경계 문장(§6-A).
       * `lines` 는 삭제 불가 법정 고지라 여기에 섞지 않는다.
       */
      boundaryNote: string | null;
    };

export interface ReunionCut {
  /** 'c04-8' 형태. 제미나이 매칭 키이자 렌더 키. base 가 독점적으로 정한다. */
  id: string;
  chapterId: ReunionChapterId;
  order: number;
  /** px. beat 컷은 `beatSize` 로 결정되고 이 값은 그 높이와 같게 맞춰 둔다. */
  height: number;
  layout: ReunionCutLayout;
  beatSize?: ReunionBeatSize;
  sceneKey: ReunionSceneKey | null;
  sceneAlt?: string;
  /** 이미지를 컨테이너보다 크게 깔아 프레임 밖으로 잘라낼 때의 배율. 1 = 그대로. */
  sceneScale?: number;
  /** 최대 `REUNION_BUBBLE_SPEC.maxBubblesPerCut` 개. */
  bubbles: readonly ReunionBubble[];
  /** `\n` 포함 */
  narration?: string;
  caption?: string;
  evidenceBadges: readonly ReunionEvidenceBadge[];
  payload?: ReunionCutPayload;
  mask: ReunionCutMask;
  /** 조건부 렌더. 조건 불충족이면 컷 자체가 배열에 없다. */
  conditional?: { key: string; reason: string };
  /** 캡션·문구가 제품 안전 계약의 일부라 어떤 단계에서도 삭제 불가. */
  undeletable?: boolean;
  /** 이 컷이 싣고 있는 삭제 불가 문구 id. 테스트가 이 값으로 렌더 여부를 잠근다. */
  undeletableCopyId?: ReunionUndeletableCopyId;
  /** 밴드 확장 블록으로 붙은 컷이면 그 blockId. */
  bandBlockId?: string;
  /**
   * 금지어 검사 제외 선언과 그 사유.
   * §6-G 의 "금지어를 쓰지 않는다는 사실 자체를 대사로 만든다" 컷처럼
   * 금지 표현을 **부정하기 위해** 인용하는 경우에만 붙인다. 테스트가 개수를 잠근다.
   */
  copyExemption?: { reason: string };
}

export interface ReunionChapter {
  id: ReunionChapterId;
  index: ReunionChapterIndex;
  order: number;
  /** 1인칭 질문 제목. 따옴표를 포함한 형태로 들어온다. */
  questionTitle: string;
  /** 챕터 헤더 한 줄 부제 */
  subtitle: string;
  /** 목차/프롤로그 0-2 에 그대로 실리는 '답하는 질문' */
  answeredQuestion: string;
  /** 풀이 소제목들 */
  outline: readonly string[];
  cuts: readonly ReunionCut[];
  /** 이 장의 총 높이(px). CH05·CH06 은 값이 같아야 한다. */
  totalHeight: number;
  /** ageBand 가 이 장을 첫 스크롤에서 펼치는가 */
  expandedByDefault: boolean;
  /** 근거가 부족해 축소 렌더할 때의 사유. null 이면 정상 분량. */
  reducedReason: string | null;
  /** 이 장 뒤에 고정 CTA 를 노출할지. gate 가 deferred 이면 전 장 false. */
  allowPurchaseCta: boolean;
  footerNote: string;
}

export type ReunionGateState = 'ok' | 'deferred';

export interface ReunionGateVerdict {
  state: ReunionGateState;
  /** 자가보고와 무관하게 무조건 deferred 로 만드는 사유. */
  hardReasons: readonly string[];
  /** 자가체크 3문항에서 'unstable' 로 답한 개수 0~3. */
  softSignals: number;
  /** 자가체크를 아직 받지 못한 상태인가(인테이크 문항 미배선). */
  selfCheckAnswered: boolean;
  /** 안전 장을 먼저 펼쳐야 하는 신호가 자유 서술에 있었는가. 독자에게 라벨을 붙이지 않는다. */
  harmSignalDetected: boolean;
}

export interface ReunionReportPayload {
  version: typeof REUNION_REPORT_VERSION;
  ageBand: ReunionAgeBand;
  gate: ReunionGateVerdict;
  /** 정확히 8장. */
  chapters: readonly ReunionChapter[];
  /** 정확히 6개. CH01~CH06 에 하나씩. */
  checkpoints: readonly ReunionCheckpoint[];
  /** 컷 id 전체 목록. 제미나이 responseSchema enum 주입용. */
  cutIds: readonly string[];
  /** 밴드별 금지어 + 공통 금지어 합집합. 제미나이 프롬프트에 직렬화. */
  bannedPhrases: readonly string[];
  /** 삭제 불가 문구 id → 치환 완료된 문자열. 렌더러와 테스트가 함께 참조. */
  undeletableCopy: Readonly<Record<string, string>>;
  /** gate 가 deferred 이면 전 장에서 false. 결제 CTA 를 렌더하지 않는다(§6-C). */
  allowPurchaseCta: boolean;
}
