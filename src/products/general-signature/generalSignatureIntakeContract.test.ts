import { describe, expect, it } from 'vitest';
import {
  isGeneralSignatureGenderSelected,
  isGeneralSignatureQuestionReady,
  isGeneralSignatureRelationshipReady
} from './generalSignatureIntakeContract';

describe('general-signature intake contract', () => {
  it('requires an explicit gender selection', () => {
    expect(isGeneralSignatureGenderSelected('')).toBe(false);
    expect(isGeneralSignatureGenderSelected(undefined)).toBe(false);
    expect(isGeneralSignatureGenderSelected('male')).toBe(true);
    expect(isGeneralSignatureGenderSelected('female')).toBe(true);
  });

  it('uses the existing trimmed 15-character question rule', () => {
    expect(isGeneralSignatureQuestionReady('  12345678901234  ')).toBe(false);
    expect(isGeneralSignatureQuestionReady('  123456789012345  ')).toBe(true);
  });

  it.each(['single', 'situationship', 'dating'] as const)(
    'keeps every canonical duration reachable for %s',
    (status) => {
      const durations = ['under1', 'under3', 'under5', 'under10'] as const;
      durations.forEach((duration) => {
        expect(isGeneralSignatureRelationshipReady(status, duration)).toBe(true);
      });
      expect(isGeneralSignatureRelationshipReady(status, '')).toBe(false);
    }
  );
});
