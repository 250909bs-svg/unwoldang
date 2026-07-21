import { describe, expect, it } from 'vitest';
import {
  isLoveReadingDurationRequired,
  validateLoveReadingIntakeContext
} from './intakeContract';

const validInput = {
  relationshipStatus: 'single',
  relationshipDuration: '',
  loveReaction: 'A',
  loveFocus: 'partner-type',
  q1: '어떤 사람과 오래 갈까요?',
  q2: '반복되는 패턴이 궁금해요.'
} as const;

describe('love-reading eight-step intake contract', () => {
  it('accepts a complete single context without requiring duration', () => {
    expect(validateLoveReadingIntakeContext(validInput)).toEqual({ valid: true, errors: [] });
  });

  it.each(['dating', 'married'] as const)('requires duration for %s on step 5', (status) => {
    const result = validateLoveReadingIntakeContext({
      ...validInput,
      relationshipStatus: status,
      relationshipDuration: ''
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({
      field: 'relationshipDuration',
      step: 5
    }));
    expect(isLoveReadingDurationRequired(status)).toBe(true);
  });

  it('accepts a canonical duration for dating and married contexts', () => {
    expect(validateLoveReadingIntakeContext({
      ...validInput,
      relationshipStatus: 'dating',
      relationshipDuration: 'under3'
    }).valid).toBe(true);
    expect(validateLoveReadingIntakeContext({
      ...validInput,
      relationshipStatus: 'married',
      relationshipDuration: 'under10'
    }).valid).toBe(true);
  });

  it('routes relationship, reaction, focus, and question errors to steps 5-8', () => {
    const result = validateLoveReadingIntakeContext({
      relationshipStatus: 'unknown',
      relationshipDuration: 'forever',
      loveReaction: 'soften',
      loveFocus: 'fortune',
      q1: ' 세 ',
      q2: ''
    });

    expect(result.valid).toBe(false);
    expect(result.errors.map(({ field, step }) => ({ field, step }))).toEqual([
      { field: 'relationshipStatus', step: 5 },
      { field: 'relationshipDuration', step: 5 },
      { field: 'loveReaction', step: 6 },
      { field: 'loveFocus', step: 7 },
      { field: 'q1', step: 8 },
      { field: 'q2', step: 8 }
    ]);
  });
});
