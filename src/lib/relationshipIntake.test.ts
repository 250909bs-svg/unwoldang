import { describe, expect, it } from 'vitest';
import {
  getRelationshipStatusLabel,
  isRelationshipDurationRequired,
  RELATIONSHIP_STATUS_LABELS
} from './relationshipIntake';

describe('relationship intake branches', () => {
  it('gives every supported status a customer-facing label', () => {
    expect(RELATIONSHIP_STATUS_LABELS).toEqual({
      single: '솔로',
      situationship: '썸 타는 중',
      dating: '연애 중',
      ambiguous: '관계가 애매함',
      'breakup-reunion': '이별·재회 고민',
      married: '기혼'
    });
    expect(getRelationshipStatusLabel('breakup-reunion')).toBe('이별·재회 고민');
  });

  it('requires a duration only for established ongoing relationships', () => {
    expect(isRelationshipDurationRequired('dating')).toBe(true);
    expect(isRelationshipDurationRequired('married')).toBe(true);
    expect(isRelationshipDurationRequired('single')).toBe(false);
    expect(isRelationshipDurationRequired('situationship')).toBe(false);
    expect(isRelationshipDurationRequired('ambiguous')).toBe(false);
    expect(isRelationshipDurationRequired('breakup-reunion')).toBe(false);
  });
});
