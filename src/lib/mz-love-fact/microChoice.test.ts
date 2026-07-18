import { describe, expect, it } from 'vitest';
import { normalizeLoveReaction } from './microChoice';

describe('MZ love micro choice normalization', () => {
  it.each([
    ['soften', 'A'],
    ['confirm', 'B'],
    ['mirror', 'C'],
    ['ruminate', 'D']
  ] as const)('migrates legacy choice %s to %s', (legacy, canonical) => {
    expect(normalizeLoveReaction(legacy)).toBe(canonical);
  });

  it.each(['A', 'B', 'C', 'D'] as const)('preserves canonical choice %s', (choice) => {
    expect(normalizeLoveReaction(choice)).toBe(choice);
  });

  it('rejects unknown or non-string values', () => {
    expect(normalizeLoveReaction('E')).toBeNull();
    expect(normalizeLoveReaction(undefined)).toBeNull();
  });
});
