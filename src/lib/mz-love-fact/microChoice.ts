import type { LoveReaction } from '../../api/mockData';

export type LegacyLoveReaction = 'soften' | 'confirm' | 'mirror' | 'ruminate';

export const MZ_LOVE_CHOICE_STORAGE_KEY = 'unwoldang:mz-love-fact:micro-choice';

export const LEGACY_LOVE_REACTION_MAP: Readonly<Record<LegacyLoveReaction, LoveReaction>> = {
  soften: 'A',
  confirm: 'B',
  mirror: 'C',
  ruminate: 'D'
};

const LOVE_REACTIONS = new Set<LoveReaction>(['A', 'B', 'C', 'D']);

export function normalizeLoveReaction(value: unknown): LoveReaction | null {
  if (typeof value !== 'string') {
    return null;
  }

  if (LOVE_REACTIONS.has(value as LoveReaction)) {
    return value as LoveReaction;
  }

  return LEGACY_LOVE_REACTION_MAP[value as LegacyLoveReaction] ?? null;
}
