/**
 * 재회운 리포트 · CH03 연락 조건 집계 (명세 §3-4-2).
 *
 * **5칸이다.** 원안의 '조건 7개 중 사용자 입력 기반 4개'는 사실이 아니다 —
 * `ReunionContext` 에 '충동 연락이 아님', '무응답 시 중단 가능'에 해당하는 필드가 없다.
 * 그 둘은 `reportPresentation.ts:37-42` 의 금지 문구일 뿐이다. 7칸은 자가확인 2문항을
 * 더 받는 v1.1 항목이다.
 *
 * 표시는 `확인된 조건 3 · 아직 확인 안 됨 1 · 판단 보류 1` 이고,
 * 그 아래 **삭제 불가 캡션 `확률이 아니라 조건 개수예요.`** 가 반드시 붙는다.
 * 이 숫자는 확률이 아니라 체크리스트 집계이므로 `reportBuilder.ts:140` 의
 * 재회 확률 패턴에 걸리지 않는다.
 */

import type { SajuReportData } from '../saju/report';
import { parseCalendarDate } from './ageBand';
import { findReunionExpressionAxis } from './compatibilityAxes';
import type {
  ReunionCompatibilityAxis,
  ReunionGateVerdict,
  ReunionReadiness,
  ReunionReadinessItem
} from './reportTypes';
import type { ReunionContext } from './types';

/** 연락 상태별 '최근 연락 이후 비워 둘 최소 간격'(일). 충동 연락을 거르는 최소 장치다. */
const CONTACT_INTERVAL_DAYS: Readonly<Record<ReunionContext['contactStatus'], number | null>> = Object.freeze({
  active: 2,
  occasional: 7,
  'no-contact': 14,
  blocked: null,
  unknown: null
});

const MS_PER_DAY = 86_400_000;

/** 두 달력 날짜 사이의 일수. 시각이 아니라 날짜만 본다(시간대 때문에 하루가 밀리지 않게). */
export function daysBetween(fromISO: string | null | undefined, toISO: string | null | undefined): number | null {
  const from = parseCalendarDate(fromISO);
  const to = parseCalendarDate(toISO);
  if (!from || !to) return null;
  const fromMs = Date.UTC(from.year, from.month - 1, from.day);
  const toMs = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((toMs - fromMs) / MS_PER_DAY);
}

/** 12개 월운 점수의 중앙값. 값이 없으면 null. */
export function monthLuckMedian(monthLuck: SajuReportData['monthLuck'] | null | undefined): number | null {
  const scores = (monthLuck || [])
    .map((item) => item.score)
    .filter((score): score is number => Number.isFinite(score))
    .sort((left, right) => left - right);
  if (scores.length === 0) return null;
  const middle = Math.floor(scores.length / 2);
  return scores.length % 2 === 0 ? (scores[middle - 1] + scores[middle]) / 2 : scores[middle];
}

export interface ReunionReadinessInput {
  context: ReunionContext;
  report: Pick<SajuReportData, 'monthLuck'> | null | undefined;
  axes: readonly ReunionCompatibilityAxis[];
  gate: ReunionGateVerdict;
  /** 경과일 계산 기준. 리포트의 `createdAt` 을 넘긴다. 뷰에서 `new Date()` 를 부르지 않는다. */
  referenceInstant: string | null | undefined;
  /** `{name}` 슬롯 치환용. 비우면 슬롯이 그대로 남아 테스트가 잡는다. */
  name?: string;
  /**
   * CH02 판독표에서 '거절이나 중단 요청이 있었다'를 표시했는가.
   * 구두 거절은 `contactStatus` 에 들어오지 않으므로 이 칸이 유일한 경로다.
   */
  refusalObserved?: boolean;
}

function buildItems(input: ReunionReadinessInput): ReunionReadinessItem[] {
  const { context, report, axes, referenceInstant } = input;
  const items: ReunionReadinessItem[] = [];

  /* 1. 거절·차단이 없는가 — 입력 */
  const refused = context.contactStatus === 'blocked' || Boolean(input.refusalObserved);
  const contactUnknown = !refused && context.contactStatus === 'unknown';
  items.push({
    id: 'no-refusal',
    label: '거절이나 차단이 확인되지 않았다',
    basis: 'input',
    state: refused ? 'unmet' : contactUnknown ? 'unknown' : 'met',
    reason: input.refusalObserved
      ? '거절이나 중단 요청이 있었다고 표시하셨어요.'
      : refused
        ? '차단이나 연락 거절이 있다고 알려주셨어요.'
        : contactUnknown
          ? '연락 상태를 아직 모른다고 알려주셨어요.'
          : '거절이나 차단을 알려주신 내용에는 없었어요.',
    howToFill: refused
      ? '이 조건은 {name}님이 채우는 항목이 아니에요. 상대가 직접 의사를 표현할 때까지 비워 둡니다.'
      : '상대가 직접 말한 내용만 이 칸에 넣어요.'
  });

  /* 2. 마지막 연락 이후 간격 — 입력 */
  const threshold = CONTACT_INTERVAL_DAYS[context.contactStatus];
  const elapsedDays = daysBetween(context.lastContactAt, referenceInstant);
  const intervalState: ReunionReadinessItem['state'] =
    threshold === null || elapsedDays === null ? 'unknown' : elapsedDays >= threshold ? 'met' : 'unmet';
  items.push({
    id: 'interval',
    label: '마지막 대화 이후 간격이 충분하다',
    basis: 'input',
    state: intervalState,
    reason:
      threshold === null
        ? '연락 상태가 확인되지 않아 간격을 계산하지 않았어요.'
        : elapsedDays === null
          ? '마지막 연락일을 알려주지 않으셨어요.'
          : elapsedDays >= threshold
            ? `마지막 대화 이후 ${elapsedDays}일이 지났어요.`
            : `마지막 대화 이후 ${elapsedDays}일이 지났어요. 이 상태에서는 ${threshold}일을 기준으로 봐요.`,
    howToFill:
      elapsedDays === null
        ? '마지막으로 대화한 날짜를 입력하면 이 칸이 채워져요.'
        : '이 칸은 시간이 채워요. {name}님이 할 일은 없어요.'
  });

  /* 3. 이별 이후 경과 — 입력 */
  const tooSoon = context.breakupDuration === 'under1m';
  const durationUnknown = context.breakupDuration === 'unknown';
  items.push({
    id: 'elapsed',
    label: '이별 이후 최소한의 시간이 지났다',
    basis: 'input',
    state: tooSoon ? 'unmet' : durationUnknown ? 'unknown' : 'met',
    reason: tooSoon
      ? '헤어진 지 한 달이 되지 않았어요.'
      : durationUnknown
        ? '이별 후 기간을 알려주지 않으셨어요.'
        : '이별 이후 한 달 이상이 지났어요.',
    howToFill: tooSoon
      ? '이 칸도 시간이 채워요. 지금은 판단을 미루는 게 이 칸을 채우는 방법이에요.'
      : '이별 후 기간을 입력하면 이 칸이 채워져요.'
  });

  /* 4. 이번 달 흐름 — 계산 */
  const median = monthLuckMedian(report?.monthLuck);
  const currentScore = report?.monthLuck?.[0]?.score ?? null;
  const monthState: ReunionReadinessItem['state'] =
    median === null || currentScore === null ? 'unknown' : currentScore >= median ? 'met' : 'unmet';
  items.push({
    id: 'month-window',
    label: '이번 달이 {name}님 흐름에서 평상 이상이다',
    basis: 'calculated',
    state: monthState,
    reason:
      median === null || currentScore === null
        ? '월별 구간 자료가 없어 이 칸은 계산하지 않았어요.'
        : currentScore >= median
          ? '이번 달은 앞으로 12개월 중 가운데 이상 구간이에요.'
          : '이번 달은 앞으로 12개월 중 가운데 아래 구간이에요.',
    howToFill: '이 칸은 계산값이라 {name}님이 채우는 항목이 아니에요. CH04 의 12개월 표에서 같은 값을 봅니다.'
  });

  /* 5. 표현과 의사소통 축 — 계산 */
  const expression = findReunionExpressionAxis(axes);
  const expressionState: ReunionReadinessItem['state'] =
    !expression || expression.direction === 'insufficient'
      ? 'unknown'
      : expression.direction === 'tension'
        ? 'unmet'
        : 'met';
  items.push({
    id: 'expression-axis',
    label: '말이 오가는 방식이 부딪히는 쪽은 아니다',
    basis: 'calculated',
    state: expressionState,
    reason: !expression
      ? '두 사람의 궁합 근거가 없어 이 칸은 계산하지 않았어요.'
      : expression.direction === 'insufficient'
        ? '근거가 부족해 이 축은 판단을 보류했어요.'
        : expression.direction === 'tension'
          ? '표현 방식이 부딪히는 쪽으로 계산됐어요.'
          : '표현 방식이 부딪히는 쪽은 아니에요.',
    howToFill:
      '이 칸은 계산값이에요. 상대의 태어난 시간이 확정되면 보류가 풀릴 수 있어요.'
  });

  return items;
}

const WITHHELD_REASON = '지금은 조건을 세는 단계가 아니에요. 판정을 보류합니다.';

export function buildReunionContactReadiness(input: ReunionReadinessInput): ReunionReadiness {
  const name = input.name;
  const fill = (value: string) => (name ? value.replace(/\{name\}/gu, name) : value);
  const items = buildItems(input).map((item) => ({
    ...item,
    label: fill(item.label),
    reason: fill(item.reason),
    howToFill: fill(item.howToFill)
  }));
  const withheld =
    input.gate.state === 'deferred' ||
    input.context.contactStatus === 'blocked' ||
    Boolean(input.refusalObserved);

  return {
    met: items.filter((item) => item.state === 'met').length,
    unmet: items.filter((item) => item.state === 'unmet').length,
    unknown: items.filter((item) => item.state === 'unknown').length,
    items,
    withheld,
    withheldReason: withheld ? WITHHELD_REASON : null
  };
}

/** `확인된 조건 3 · 아직 확인 안 됨 1 · 판단 보류 1` */
export function formatReadinessTally(readiness: ReunionReadiness): string {
  return `확인된 조건 ${readiness.met} · 아직 확인 안 됨 ${readiness.unmet} · 판단 보류 ${readiness.unknown}`;
}

/**
 * `알려주신 것 3칸 · 제가 계산한 것 2칸`.
 *
 * 다섯 칸은 출처가 섞여 있다 — 세 칸은 독자가 알려준 것(◇), 두 칸은 명식 계산(◆)이다.
 * 게이지가 한 숫자로 합산하면서 그 구분을 지우면, 프롤로그에서 선언한
 * '계산한 것과 알려주신 것을 섞지 않는다'가 같은 리포트 안에서 깨진다.
 */
export function formatReadinessBasisSplit(readiness: ReunionReadiness): string {
  const input = readiness.items.filter((item) => item.basis === 'input').length;
  const calculated = readiness.items.length - input;
  return `알려주신 것 ${input}칸 · 제가 계산한 것 ${calculated}칸`;
}
