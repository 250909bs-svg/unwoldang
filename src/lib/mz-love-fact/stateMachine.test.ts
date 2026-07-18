import { describe, expect, it } from 'vitest';
import {
  createMzLoveStateSnapshot,
  MzLoveTransitionError,
  restoreMzLoveState,
  serializeMzLoveState,
  transitionMzLoveState,
} from './stateMachine';

const at = '2026-07-17T00:00:00.000Z';

describe('MZ love recoverable state machine', () => {
  it('moves through the complete paid experience in order', () => {
    let state = createMzLoveStateSnapshot(at);
    state = transitionMzLoveState(state, { type: 'ENTER_ROOM', at });
    state = transitionMzLoveState(state, { type: 'REVEAL_CHARACTER', at });
    state = transitionMzLoveState(state, { type: 'START_MICRO_CHOICE', at });
    state = transitionMzLoveState(state, { type: 'SELECT_MICRO_CHOICE', choice: 'D', at });
    state = transitionMzLoveState(state, { type: 'SUBMIT_BIRTH', at });
    state = transitionMzLoveState(state, { type: 'CALCULATION_SUCCEEDED', previewId: 'preview-1', at });
    state = transitionMzLoveState(state, { type: 'SHOW_LOCKED_CHAPTERS', at });
    state = transitionMzLoveState(state, { type: 'START_CHECKOUT', at });
    state = transitionMzLoveState(state, { type: 'PAYMENT_CONFIRMED', reportId: 'report-1', at });
    state = transitionMzLoveState(state, { type: 'GENERATION_STATUS', status: 'completed', at });
    state = transitionMzLoveState(state, { type: 'OPEN_REPORT', at });
    state = transitionMzLoveState(state, { type: 'OPEN_CHAPTERS', at });
    state = transitionMzLoveState(state, { type: 'COMPLETE_CHAPTER', chapterId: 'love-self', at });
    state = transitionMzLoveState(state, { type: 'OPEN_ACTION_PLAN', at });
    state = transitionMzLoveState(state, { type: 'OPEN_SHARE', at });
    expect(state.state).toBe('SHARE_AND_RECOMMEND');
    expect(state.paymentStatus).toBe('confirmed');
    expect(state.completedChapterIds).toEqual(['love-self']);
  });

  it('does not open a report until generation is completed', () => {
    let state = createMzLoveStateSnapshot(at);
    state = { ...state, state: 'FULL_GENERATION', reportId: 'report-1', paymentStatus: 'confirmed', generationStatus: 'rendering_report' };
    expect(() => transitionMzLoveState(state, { type: 'OPEN_REPORT', at })).toThrow(MzLoveTransitionError);
  });

  it('restores only the allow-listed recoverable state fields', () => {
    const serialized = serializeMzLoveState({
      ...createMzLoveStateSnapshot(at),
      state: 'MICRO_CHOICE',
      completedChapterIds: ['love-self'],
    });
    const withPii = serialized.replace(/}$/, ',"displayName":"비공개 이름"}');
    const restored = restoreMzLoveState(withPii);
    expect(restored?.state).toBe('MICRO_CHOICE');
    expect(restored).not.toHaveProperty('displayName');
  });
});
