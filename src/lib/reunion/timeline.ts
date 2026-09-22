/**
 * 재회운 리포트 · CH04 12개월 지도 / CH06 연운 / 판단 기한 제안 (명세 §3-4-3, §3-4-4).
 *
 * 규칙:
 * - `monthLuck[].score` 를 **그대로 쓰되 이름만 바꾼다.** 새 점수를 만들지 않는다.
 * - 축 라벨에서 `재회`·`연락` 단어를 제거한다. 이 표는 {이름}님 명식의 월별 흐름이지
 *   상대의 행동을 예측한 값이 아니다.
 * - `open` 구간에는 **관찰 가능한 조건을 반드시 붙인다.** 조건 없는 시기는 렌더하지 않는다.
 * - 판단 기한은 **날짜 1개를 확정하지 않는다.** 서버는 범위만 제안하고 독자가 직접 쓴다.
 *   그래야 `{이름}님이 정한 점검일이에요` 가 참이 된다.
 * - 이 파일은 `new Date()` 를 현재 시각으로 부르지 않는다. 기준 시각은 호출자가 넘긴다.
 */

import type { SajuReportData } from '../saju/report';
import type {
  ReunionCheckpointSuggestion,
  ReunionTimelineCell,
  ReunionTimingLabel,
  ReunionYearCell
} from './reportTypes';
import { REUNION_OPEN_WINDOW_CONDITIONS } from './signalTable';
import type { ReunionContext } from './types';

const MS_PER_DAY = 86_400_000;

function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * fraction;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

/** 절기 경계가 없을 때만 쓰는 월 경계 대체값. 있으면 `validFrom`/`validTo` 를 그대로 쓴다. */
function monthBoundary(year: number, month: number, end: boolean): string {
  const base = end ? Date.UTC(year, month, 1) : Date.UTC(year, month - 1, 1);
  return new Date(base).toISOString();
}

/**
 * 12개월 지도. 분위는 12개 score 의 33/67 퍼센타일.
 * 점수에 퍼짐이 없으면(33분위 = 67분위) 전부 `normal` 로 둔다 —
 * 근거 없이 좋은 달과 나쁜 달을 만들어 내지 않는다.
 */
export function buildReunionTimeline(
  report: Pick<SajuReportData, 'monthLuck'> | null | undefined
): ReunionTimelineCell[] {
  const source = report?.monthLuck || [];
  if (source.length === 0) return [];

  const scores = source
    .map((item) => item.score)
    .filter((score): score is number => Number.isFinite(score))
    .sort((left, right) => left - right);
  const low = percentile(scores, 1 / 3);
  const high = percentile(scores, 2 / 3);
  const hasSpread = high > low;

  return source.map((item) => {
    const score = Number.isFinite(item.score) ? item.score : 0;
    let label: ReunionTimingLabel = 'normal';
    if (hasSpread && score >= high) label = 'open';
    else if (hasSpread && score <= low) label = 'hold';

    return {
      year: item.year,
      month: item.month,
      ganzhi: item.ganzhi,
      score,
      label,
      validFrom: item.validFrom || monthBoundary(item.year, item.month, false),
      validTo: item.validTo || monthBoundary(item.year, item.month, true),
      focus: item.focus || '',
      warning: item.warning || '',
      /* 구간별로 다른 조건을 만들 근거가 없다 — 전 구간 공통 조건을 그대로 붙인다. */
      conditions: label === 'open' ? REUNION_OPEN_WINDOW_CONDITIONS : []
    };
  });
}

/**
 * CH06 연운 5개. CH04 의 가로 막대와 **시각 문법을 일부러 다르게** 쓰기 위해 세로 타임라인용으로 낸다.
 * 이 표는 누가 나타나는 시점이 아니라 {이름}님 쪽 여력이 바뀌는 지점이다.
 */
export function buildReunionYearTimeline(
  report: Pick<SajuReportData, 'yearLuck'> | null | undefined,
  limit = 5
): ReunionYearCell[] {
  const source = (report?.yearLuck || []).slice(0, limit);
  if (source.length === 0) return [];

  const scores = source
    .map((item) => item.score)
    .filter((score): score is number => Number.isFinite(score))
    .sort((left, right) => left - right);
  const low = percentile(scores, 1 / 3);
  const high = percentile(scores, 2 / 3);
  const hasSpread = high > low;

  return source.map((item) => {
    const score = Number.isFinite(item.score) ? item.score : 0;
    let label: ReunionTimingLabel = 'normal';
    if (hasSpread && score >= high) label = 'open';
    else if (hasSpread && score <= low) label = 'hold';
    return {
      year: item.year,
      ganzhi: item.ganzhi,
      score,
      label,
      summary: item.summary || '',
      focus: item.focus || ''
    };
  });
}

/** 연락 상태별 기본 판단 창(일). 날짜가 아니라 **범위**의 시작과 끝이다. */
const BASE_WINDOW_DAYS: Readonly<Record<ReunionContext['contactStatus'], readonly [number, number]>> =
  Object.freeze({
    active: [14, 35],
    occasional: [21, 49],
    'no-contact': [30, 75],
    blocked: [45, 90],
    unknown: [45, 90]
  });

function addDays(instantMs: number, days: number): Date {
  return new Date(instantMs + days * MS_PER_DAY);
}

function formatKoreanMonth(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}년 ${kst.getUTCMonth() + 1}월`;
}

export interface ReunionCheckpointSuggestionInput {
  context: ReunionContext;
  timeline: readonly ReunionTimelineCell[];
  /** 기준 시각. 리포트의 `createdAt` 또는 basis 의 `generatedFor.instant`. */
  referenceInstant: string | null | undefined;
}

/**
 * 판단 기한 **제안 범위**. 날짜 1개를 확정하지 않는다.
 *
 * 조립 순서:
 *   1. 기준일 + 연락 상태별 기본 창
 *   2. 기준일이 걸친 구간이 `hold` 면 그 구간이 끝난 뒤로 시작을 민다
 *   3. 가장 가까운 `open` 구간이 창 근처에 있으면 그 구간 끝까지 창을 넓힌다
 *
 * 기준 시각이 없으면 `null` 을 돌려주고, 화면은 제안 배지 없이 빈 입력만 그린다.
 */
export function buildReunionCheckpointSuggestion(
  input: ReunionCheckpointSuggestionInput
): ReunionCheckpointSuggestion | null {
  const base = input.referenceInstant ? new Date(input.referenceInstant) : null;
  if (!base || Number.isNaN(base.getTime())) return null;

  const baseMs = base.getTime();
  const [minDays, maxDays] = BASE_WINDOW_DAYS[input.context.contactStatus] || BASE_WINDOW_DAYS.unknown;
  let from = addDays(baseMs, minDays);
  let to = addDays(baseMs, maxDays);
  const notes: string[] = [];

  const holdNow = input.timeline.find((cell) => {
    if (cell.label !== 'hold' || !cell.validFrom || !cell.validTo) return false;
    const start = new Date(cell.validFrom).getTime();
    const end = new Date(cell.validTo).getTime();
    return Number.isFinite(start) && Number.isFinite(end) && baseMs >= start && baseMs < end;
  });
  if (holdNow?.validTo) {
    const holdEnd = new Date(holdNow.validTo);
    if (holdEnd.getTime() > from.getTime()) {
      from = holdEnd;
      notes.push('지금 지나는 구간이 보류 쪽이라 그 구간이 끝난 뒤부터 잡았어요');
    }
  }

  const nextOpen = input.timeline.find((cell) => {
    if (cell.label !== 'open' || !cell.validFrom) return false;
    const start = new Date(cell.validFrom).getTime();
    return Number.isFinite(start) && start >= baseMs;
  });
  if (nextOpen?.validTo) {
    const openEnd = new Date(nextOpen.validTo);
    const openStart = new Date(nextOpen.validFrom || nextOpen.validTo).getTime();
    if (openStart <= to.getTime() + 45 * MS_PER_DAY && openEnd.getTime() > to.getTime()) {
      to = openEnd;
      notes.push('말문을 열기 나은 구간이 이 안에 들어오도록 끝을 늘렸어요');
    }
  }

  if (to.getTime() <= from.getTime()) to = addDays(from.getTime(), 21);

  const fromISO = from.toISOString();
  const toISO = to.toISOString();
  const rationale = [
    notes.join('. '),
    '이 범위는 제안일 뿐이에요. 날짜는 {name}님이 직접 정하시고, 범위 밖으로 잡으셔도 괜찮아요.'
  ]
    .filter(Boolean)
    .join('. ');

  return {
    fromISO,
    toISO,
    rationale,
    label: `${formatKoreanMonth(fromISO)} ~ ${formatKoreanMonth(toISO)}`
  };
}

export const REUNION_TIMING_LABELS: Readonly<Record<ReunionTimingLabel, string>> = Object.freeze({
  open: '말문 열기 나음',
  normal: '평상',
  hold: '보류'
});

/**
 * '기록만' 모드의 12개월 라벨.
 *
 * 게이트가 보류로 나온 독자에게 `말문 열기 나음` 은 시기 권유로 읽힌다. 차트 자체는
 * 독자 명식의 흐름이라 남기되(삭제 불가 캡션이 이 컷에 붙어 있다), 라벨은 독자 쪽 상태만
 * 말하는 어휘로 바꾼다. 점수도 구간도 그대로다 — 부르는 이름만 다르다.
 */
export const REUNION_RECORD_ONLY_TIMING_LABELS: Readonly<Record<ReunionTimingLabel, string>> =
  Object.freeze({
    open: '여력이 도는 구간',
    normal: '평상',
    hold: '여력이 낮은 구간'
  });

/**
 * CH06 연운 라벨.
 *
 * 이 장은 관계를 놓았을 때의 흐름을 쓰고, 캡션은 '{이름}님 쪽 여력이 바뀌는 지점'이라고 말한다.
 * 같은 장의 노드에 `말문 열기 나음` 을 붙이면 캡션과 정면으로 어긋난다.
 */
export const REUNION_YEAR_TIMING_LABELS: Readonly<Record<ReunionTimingLabel, string>> = Object.freeze({
  open: '여력이 도는 해',
  normal: '평상',
  hold: '숨 고르는 해'
});
