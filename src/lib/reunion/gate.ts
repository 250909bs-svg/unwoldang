/**
 * 재회운 리포트 · CH00 판단 게이트 (명세 §3-4-1, §6-C).
 *
 * **하드 조건은 자가보고로 우회할 수 없다.** 읽고 싶은 독자는 '잘 잤다'를 고르기 때문에
 * 자가체크 3문항은 가중치로만 쓴다.
 *
 * `deferred` 판정의 결과:
 *   - 이후 모든 장의 행동 지시가 '기록만' 모드로 내려간다 (연락 설계 → 보류 설계)
 *   - CH03 게이지를 숨기고 '판정 보류' 카드로 대체한다
 *   - **결제 CTA 를 렌더하지 않는다.** 취약한 상태의 사람에게 파는 순간 이 상품의 전제가 무너진다.
 */

import type { ReunionContext } from './types';
import type { ReunionGateVerdict } from './reportTypes';
import { findReunionHarmSignals } from './safetyCopy';

export type ReunionSelfCheckAnswer = 'ok' | 'unstable' | 'unknown';

/**
 * CH00 자가체크 3문항. 전부 **사실 확인형** 문장이다(감정을 묻지 않는다).
 *
 * 주의: `ReunionContext` v1 에는 이 필드가 없다. 인테이크 3단계 배선(명세 §3-3, Phase 3)이
 * 끝나기 전까지는 전부 'unknown' 으로 들어오고, 게이트는 하드 조건만으로 판정한다.
 * 컨텍스트 스키마를 v2 로 올리는 일은 `ReunionIntake.tsx`·`reunionFlow.ts` 와 겹치므로
 * 여기서는 **선택 입력**으로 받는다.
 */
export interface ReunionSelfCheck {
  sleep: ReunionSelfCheckAnswer;
  meals: ReunionSelfCheckAnswer;
  routine: ReunionSelfCheckAnswer;
}

export const REUNION_SELF_CHECK_QUESTIONS: readonly { id: keyof ReunionSelfCheck; label: string }[] =
  Object.freeze([
    { id: 'sleep', label: '최근 일주일, 잠이 평소대로였나요' },
    { id: 'meals', label: '최근 일주일, 끼니를 평소대로 챙기셨나요' },
    { id: 'routine', label: '최근 일주일, 일이나 학업 일정을 평소대로 지키셨나요' }
  ]);

export function createEmptyReunionSelfCheck(): ReunionSelfCheck {
  return { sleep: 'unknown', meals: 'unknown', routine: 'unknown' };
}

const HARD_REASON_BLOCKED = '연락이 차단되었거나 거절된 상태라고 알려주셨어요. 지금은 판단보다 보류가 먼저예요.';
const HARD_REASON_UNKNOWN_CONTACT = '연락 상태를 아직 확인하지 못했어요. 확인 전에는 행동을 설계하지 않아요.';
const HARD_REASON_TOO_SOON = '헤어진 지 한 달이 되지 않았어요. 이 시기의 판단은 며칠 뒤에 스스로 뒤집히는 일이 많아요.';
export const HARD_REASON_REFUSAL_STATED =
  '거절이나 중단 요청이 있었다고 표시하셨어요. 그 사실이 이 리포트의 어떤 계산보다 먼저예요.';
const SOFT_REASON = '수면·식사·일상 중 두 가지 이상이 흔들린다고 답하셨어요.';

/** CH02 신호 판독표에서 이 항목이 켜지면 다른 항목보다 먼저 본다(`signalTable.ts` 의 약속). */
export const REUNION_REFUSAL_SIGNAL_ID = 'refusal-stated';

export interface ReunionGateInput {
  context: ReunionContext;
  selfCheck?: ReunionSelfCheck | null;
  /**
   * CH02 신호 판독표의 '거절이나 중단 요청이 있었다' 체크.
   *
   * 구두 거절은 `contactStatus` 로 들어오지 않는다 — 상대가 그만 연락하라고 **말한** 경우에도
   * 독자는 `no-contact`/`occasional` 을 고르기 때문에 하드 조건에 걸리지 않는다.
   * 그래서 이 한 칸이 게이트의 독립 하드 조건이다. 수집만 하고 버리면
   * 가장 중요한 신호를 읽고도 연락 설계를 계속 유지하는 경로가 생긴다.
   */
  refusalObserved?: boolean;
}

/**
 * 게이트 판정.
 *
 * 하드 조건 (자가보고와 무관):
 *   - `contactStatus === 'blocked' | 'unknown'`
 *   - `breakupDuration === 'under1m'`
 *   - CH02 판독표에서 거절·중단 요청을 표시
 * 소프트 조건:
 *   - 자가체크에서 'unstable' 2개 이상
 */
export function buildReunionGate(input: ReunionGateInput): ReunionGateVerdict {
  const { context } = input;
  const selfCheck = input.selfCheck || createEmptyReunionSelfCheck();
  const answers = [selfCheck.sleep, selfCheck.meals, selfCheck.routine];
  const selfCheckAnswered = answers.some((answer) => answer !== 'unknown');
  const softSignals = answers.filter((answer) => answer === 'unstable').length;

  const hardReasons: string[] = [];
  if (input.refusalObserved) hardReasons.push(HARD_REASON_REFUSAL_STATED);
  if (context.contactStatus === 'blocked') hardReasons.push(HARD_REASON_BLOCKED);
  if (context.contactStatus === 'unknown') hardReasons.push(HARD_REASON_UNKNOWN_CONTACT);
  if (context.breakupDuration === 'under1m') hardReasons.push(HARD_REASON_TOO_SOON);

  const harmSignalDetected = findReunionHarmSignals(context.breakupReason, context.notes).length > 0;
  const deferred = hardReasons.length > 0 || softSignals >= 2;

  return {
    state: deferred ? 'deferred' : 'ok',
    hardReasons: Object.freeze([...hardReasons, ...(softSignals >= 2 ? [SOFT_REASON] : [])]),
    softSignals,
    selfCheckAnswered,
    harmSignalDetected
  };
}

/** deferred 독자에게는 결제 유도를 하지 않는다. 이 함수 하나가 §6-C-2 의 전부다. */
export function allowReunionPurchaseCta(gate: ReunionGateVerdict): boolean {
  return gate.state === 'ok';
}

/** deferred 독자의 행동 지시는 전부 '기록만' 모드로 내려간다. */
export function isReunionRecordOnlyMode(gate: ReunionGateVerdict): boolean {
  return gate.state === 'deferred';
}
