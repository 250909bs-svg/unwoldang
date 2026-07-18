import { describe, expect, it } from 'vitest';
import { mapIntakeRelationshipStatus } from './relationshipStatusAdapter';

describe('mapIntakeRelationshipStatus', () => {
  it.each([
    [undefined, undefined],
    ['', undefined],
    ['single', 'single'],
    ['situationship', 'situationship'],
    ['dating', 'dating'],
    ['ambiguous', 'ambiguous'],
    ['breakup-reunion', 'breakup-reunion'],
    ['married', 'long-term'],
  ] as const)('maps %s to %s', (input, expected) => {
    expect(mapIntakeRelationshipStatus(input)).toBe(expected);
  });
});
