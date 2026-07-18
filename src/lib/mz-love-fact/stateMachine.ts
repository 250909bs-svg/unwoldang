import { MZ_LOVE_CHAPTER_IDS } from './types';
import type {
  MzLoveChapterId,
  MzLoveExperienceState,
  MzLoveInput,
  MzLoveStateSnapshot,
  ReportGenerationStatus,
} from './types';

export const MZ_LOVE_STATE_SEQUENCE: readonly MzLoveExperienceState[] = [
  'TEASER_ENTRY', 'ROOM_ENTER', 'CHARACTER_REVEAL', 'MICRO_CHOICE', 'BIRTH_INPUT',
  'SAJU_CALCULATION', 'FREE_FACT_REVEAL', 'LOCKED_CHAPTERS', 'CHECKOUT',
  'FULL_GENERATION', 'REPORT_OPENING', 'REPORT_CHAPTERS', 'ACTION_PLAN', 'SHARE_AND_RECOMMEND',
];

export type MzLoveStateEvent =
  | { type: 'ENTER_ROOM'; at: string }
  | { type: 'REVEAL_CHARACTER'; at: string }
  | { type: 'START_MICRO_CHOICE'; at: string }
  | { type: 'SELECT_MICRO_CHOICE'; choice: NonNullable<MzLoveInput['microChoice']>; at: string }
  | { type: 'SUBMIT_BIRTH'; at: string }
  | { type: 'CALCULATION_SUCCEEDED'; previewId: string; at: string }
  | { type: 'CALCULATION_FAILED'; errorCode: string; at: string }
  | { type: 'SHOW_LOCKED_CHAPTERS'; at: string }
  | { type: 'START_CHECKOUT'; at: string }
  | { type: 'PAYMENT_CONFIRMED'; reportId: string; at: string }
  | { type: 'GENERATION_STATUS'; status: ReportGenerationStatus; errorCode?: string; at: string }
  | { type: 'OPEN_REPORT'; at: string }
  | { type: 'OPEN_CHAPTERS'; at: string }
  | { type: 'COMPLETE_CHAPTER'; chapterId: MzLoveChapterId; at: string }
  | { type: 'OPEN_ACTION_PLAN'; at: string }
  | { type: 'OPEN_SHARE'; at: string };

const EXPECTED_EVENT: Partial<Record<MzLoveExperienceState, MzLoveStateEvent['type']>> = {
  TEASER_ENTRY: 'ENTER_ROOM',
  ROOM_ENTER: 'REVEAL_CHARACTER',
  CHARACTER_REVEAL: 'START_MICRO_CHOICE',
  MICRO_CHOICE: 'SELECT_MICRO_CHOICE',
  BIRTH_INPUT: 'SUBMIT_BIRTH',
  FREE_FACT_REVEAL: 'SHOW_LOCKED_CHAPTERS',
  LOCKED_CHAPTERS: 'START_CHECKOUT',
  CHECKOUT: 'PAYMENT_CONFIRMED',
  REPORT_OPENING: 'OPEN_CHAPTERS',
  ACTION_PLAN: 'OPEN_SHARE',
};

export class MzLoveTransitionError extends Error {
  constructor(state: MzLoveExperienceState, event: MzLoveStateEvent['type']) {
    super(`Cannot apply ${event} while MZ love experience is in ${state}`);
    this.name = 'MzLoveTransitionError';
  }
}

export function createMzLoveStateSnapshot(at: string): MzLoveStateSnapshot {
  return {
    version: 1,
    state: 'TEASER_ENTRY',
    updatedAt: at,
    paymentStatus: 'not-started',
    completedChapterIds: [],
  };
}

function update(
  snapshot: MzLoveStateSnapshot,
  at: string,
  patch: Partial<MzLoveStateSnapshot>,
): MzLoveStateSnapshot {
  return { ...snapshot, ...patch, version: 1, updatedAt: at };
}

export function transitionMzLoveState(
  snapshot: MzLoveStateSnapshot,
  event: MzLoveStateEvent,
): MzLoveStateSnapshot {
  if (snapshot.state === 'SAJU_CALCULATION') {
    if (event.type === 'CALCULATION_FAILED') {
      return update(snapshot, event.at, { errorCode: event.errorCode });
    }
    if (event.type === 'CALCULATION_SUCCEEDED') {
      return update(snapshot, event.at, { state: 'FREE_FACT_REVEAL', previewId: event.previewId, errorCode: undefined });
    }
  }
  if (snapshot.state === 'FULL_GENERATION' && event.type === 'GENERATION_STATUS') {
    return update(snapshot, event.at, {
      generationStatus: event.status,
      errorCode: event.status === 'failed' ? (event.errorCode ?? 'generation-failed') : undefined,
    });
  }
  if (snapshot.state === 'FULL_GENERATION' && event.type === 'OPEN_REPORT' && snapshot.generationStatus === 'completed') {
    return update(snapshot, event.at, { state: 'REPORT_OPENING' });
  }
  if (snapshot.state === 'REPORT_CHAPTERS' && event.type === 'COMPLETE_CHAPTER') {
    const completed = [...new Set([...snapshot.completedChapterIds, event.chapterId])];
    return update(snapshot, event.at, { completedChapterIds: completed });
  }
  if (snapshot.state === 'REPORT_CHAPTERS' && event.type === 'OPEN_ACTION_PLAN') {
    return update(snapshot, event.at, { state: 'ACTION_PLAN' });
  }

  if (EXPECTED_EVENT[snapshot.state] !== event.type) {
    throw new MzLoveTransitionError(snapshot.state, event.type);
  }
  switch (event.type) {
    case 'ENTER_ROOM': return update(snapshot, event.at, { state: 'ROOM_ENTER' });
    case 'REVEAL_CHARACTER': return update(snapshot, event.at, { state: 'CHARACTER_REVEAL' });
    case 'START_MICRO_CHOICE': return update(snapshot, event.at, { state: 'MICRO_CHOICE' });
    case 'SELECT_MICRO_CHOICE': return update(snapshot, event.at, { state: 'BIRTH_INPUT', microChoice: event.choice });
    case 'SUBMIT_BIRTH': return update(snapshot, event.at, { state: 'SAJU_CALCULATION', errorCode: undefined });
    case 'SHOW_LOCKED_CHAPTERS': return update(snapshot, event.at, { state: 'LOCKED_CHAPTERS' });
    case 'START_CHECKOUT': return update(snapshot, event.at, { state: 'CHECKOUT', paymentStatus: 'pending' });
    case 'PAYMENT_CONFIRMED': return update(snapshot, event.at, { state: 'FULL_GENERATION', reportId: event.reportId, paymentStatus: 'confirmed', generationStatus: 'queued' });
    case 'OPEN_CHAPTERS': return update(snapshot, event.at, { state: 'REPORT_CHAPTERS' });
    case 'OPEN_SHARE': return update(snapshot, event.at, { state: 'SHARE_AND_RECOMMEND' });
    default: throw new MzLoveTransitionError(snapshot.state, event.type);
  }
}

export function serializeMzLoveState(snapshot: MzLoveStateSnapshot): string {
  return JSON.stringify(snapshot);
}

export function restoreMzLoveState(serialized: string): MzLoveStateSnapshot | null {
  try {
    const value = JSON.parse(serialized) as Partial<MzLoveStateSnapshot>;
    if (value.version !== 1 || !value.state || !MZ_LOVE_STATE_SEQUENCE.includes(value.state)) return null;
    if (typeof value.updatedAt !== 'string' || !['not-started', 'pending', 'confirmed'].includes(value.paymentStatus ?? '')) return null;
    const completed = (value.completedChapterIds ?? []).filter((id): id is MzLoveChapterId =>
      MZ_LOVE_CHAPTER_IDS.includes(id as MzLoveChapterId),
    );
    return {
      version: 1,
      state: value.state,
      updatedAt: value.updatedAt,
      previewId: typeof value.previewId === 'string' ? value.previewId : undefined,
      reportId: typeof value.reportId === 'string' ? value.reportId : undefined,
      microChoice: value.microChoice,
      paymentStatus: value.paymentStatus!,
      generationStatus: value.generationStatus,
      completedChapterIds: [...new Set(completed)],
      errorCode: typeof value.errorCode === 'string' ? value.errorCode : undefined,
    };
  } catch {
    return null;
  }
}
