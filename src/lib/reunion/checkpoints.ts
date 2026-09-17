/**
 * 재회운 리포트 · CH07 닫는 집계 (명세 §3-4-5, CH07 c07-1/c07-2).
 *
 * **장마다 판정 카드를 렌더하지 않는다.** 집계는 CH07 에서 한 번만 한다
 * (반복 판정이 스킵을 유발한다는 만족도 지적).
 *
 * 이 숫자는 **이 리포트의 유일한 집계 숫자이자 예측이 아니므로 100% 정직하다.**
 * CH00 에서 회색이던 6칸이 여기서 상태 점으로 채워진다.
 */

import type {
  ReunionChapterIndex,
  ReunionCheckpoint,
  ReunionCheckpointState,
  ReunionCompatibilityAxis,
  ReunionGateVerdict,
  ReunionReadiness,
  ReunionTimelineCell
} from './reportTypes';
import type { ReunionContext } from './types';

export interface ReunionCheckpointInput {
  context: ReunionContext;
  gate: ReunionGateVerdict;
  axes: readonly ReunionCompatibilityAxis[];
  readiness: ReunionReadiness;
  timeline: readonly ReunionTimelineCell[];
  yearCellCount: number;
  /** 본인 사주 근거가 실제로 있는가(원국 4주 + 십성). */
  hasNatalEvidence: boolean;
}

interface CheckpointSpec {
  id: string;
  chapter: ReunionChapterIndex;
  question: string;
  resolve: (input: ReunionCheckpointInput) => { state: ReunionCheckpointState; why: string | null };
}

const DEFERRED_WHY = '지금은 판단을 미루기로 한 상태라 이 항목은 접어 두었어요.';

const SPECS: readonly CheckpointSpec[] = Object.freeze([
  {
    id: 'breakup-reason',
    chapter: 1,
    question: '우리, 왜 헤어진 걸까요?',
    resolve: (input) =>
      input.hasNatalEvidence
        ? { state: 'confirmed', why: null }
        : { state: 'unconfirmed', why: '태어난 시간이 확정되지 않아 원국 일부를 고정하지 못했어요.' }
  },
  {
    id: 'partner-state',
    chapter: 2,
    question: '그 사람 마음은 지금 어떤가요?',
    resolve: (input) => {
      const usable = input.axes.filter((axis) => axis.direction !== 'insufficient');
      if (usable.length === 0) {
        return {
          state: 'unconfirmed',
          why: '상대의 생년월일이나 태어난 시간이 없어 두 명식을 맞물려 볼 수 없었어요.'
        };
      }
      return {
        state: 'unconfirmed',
        why: '마음 자체는 계산으로 확인할 수 없어요. 맞물리는 구조만 확인했어요.'
      };
    }
  },
  {
    id: 'contact-readiness',
    chapter: 3,
    question: '지금, 연락해도 될까요?',
    resolve: (input) => {
      if (input.readiness.withheld) return { state: 'deferred', why: DEFERRED_WHY };
      if (input.readiness.unknown === 0) return { state: 'confirmed', why: null };
      return { state: 'unconfirmed', why: `조건 ${input.readiness.unknown}개가 아직 확인되지 않았어요.` };
    }
  },
  {
    id: 'twelve-months',
    chapter: 4,
    question: '언제쯤이 괜찮을까요?',
    resolve: (input) =>
      input.timeline.length >= 12
        ? { state: 'confirmed', why: null }
        : {
            state: 'unconfirmed',
            why: '월별 구간 자료가 12개보다 적어 흐름을 다 그리지 못했어요.'
          }
  },
  {
    id: 'repeat-risk',
    chapter: 5,
    question: '다시 만나면, 또 똑같아지지 않을까요?',
    resolve: (input) => {
      const continuity = input.axes.find((axis) => axis.label.includes('지속'));
      if (!continuity || continuity.direction === 'insufficient') {
        return { state: 'unconfirmed', why: '관계 지속 축의 근거가 부족해 판단을 보류했어요.' };
      }
      return { state: 'confirmed', why: null };
    }
  },
  {
    id: 'other-door',
    chapter: 6,
    question: '재회가 아니면, 저는 어떻게 되나요?',
    resolve: (input) =>
      input.yearCellCount > 0
        ? { state: 'confirmed', why: null }
        : { state: 'unconfirmed', why: '연운 자료가 없어 앞으로의 구간을 그리지 못했어요.' }
  }
]);

/** 정확히 6개. CH01~CH06 에 하나씩. */
export function buildReunionCheckpoints(input: ReunionCheckpointInput): ReunionCheckpoint[] {
  return SPECS.map((spec) => {
    if (input.gate.state === 'deferred' && spec.chapter >= 3) {
      return { id: spec.id, chapter: spec.chapter, question: spec.question, state: 'deferred' as const, why: DEFERRED_WHY };
    }
    const resolved = spec.resolve(input);
    return {
      id: spec.id,
      chapter: spec.chapter,
      question: spec.question,
      state: resolved.state,
      why: resolved.why
    };
  });
}

export function tallyReunionCheckpoints(checkpoints: readonly ReunionCheckpoint[]) {
  return {
    confirmed: checkpoints.filter((item) => item.state === 'confirmed').length,
    unconfirmed: checkpoints.filter((item) => item.state === 'unconfirmed').length,
    deferred: checkpoints.filter((item) => item.state === 'deferred').length
  };
}

/** `여섯 질문 중 지금 확인된 것 N개, 아직 확인할 수 없는 것 M개` */
export function formatCheckpointTally(checkpoints: readonly ReunionCheckpoint[]): string {
  const tally = tallyReunionCheckpoints(checkpoints);
  return `여섯 질문 중 지금 확인된 것 ${tally.confirmed}개, 아직 확인할 수 없는 것 ${
    tally.unconfirmed + tally.deferred
  }개`;
}

/** CH07 c07-2 미확인 항목 카드. 모르는 걸 모른다고 말하는 이 컷이 신뢰의 최종 근거다. */
export function buildReunionUnconfirmedCards(checkpoints: readonly ReunionCheckpoint[]) {
  return checkpoints
    .filter((item) => item.state !== 'confirmed' && item.why)
    .map((item) => ({ label: item.question, why: item.why as string }));
}
