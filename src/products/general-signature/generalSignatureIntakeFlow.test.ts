import { describe, expect, it } from 'vitest';
import {
  GENERAL_SIGNATURE_INTAKE_STEPS,
  getGeneralSignatureStepProgress,
  getNextGeneralSignatureStep,
  parseTypedBirthTime
} from './generalSignatureIntakeFlow';

describe('general-signature immersive intake flow', () => {
  it('keeps relationship duration inline and advances to the first question', () => {
    expect(GENERAL_SIGNATURE_INTAKE_STEPS).not.toContain('relationship-duration');
    expect(getNextGeneralSignatureStep('relationship')).toBe('question-one');
  });

  it('preserves compact time entry until four digits are available', () => {
    expect(parseTypedBirthTime('1')).toEqual({ displayValue: '1', canonicalValue: '' });
    expect(parseTypedBirthTime('10')).toEqual({ displayValue: '10', canonicalValue: '' });
    expect(parseTypedBirthTime('102')).toEqual({ displayValue: '102', canonicalValue: '' });
    expect(parseTypedBirthTime('1024')).toEqual({ displayValue: '10:24', canonicalValue: '10:24' });
  });

  it('normalizes a three-digit time only when entry is finalized', () => {
    expect(parseTypedBirthTime('936')).toEqual({ displayValue: '936', canonicalValue: '' });
    expect(parseTypedBirthTime('936', true)).toEqual({ displayValue: '09:36', canonicalValue: '09:36' });
  });

  it('rejects invalid clock values', () => {
    expect(parseTypedBirthTime('2460')).toEqual({ displayValue: '24:60', canonicalValue: '' });
    expect(parseTypedBirthTime('999')).toEqual({ displayValue: '999', canonicalValue: '' });
    expect(parseTypedBirthTime('999', true)).toEqual({ displayValue: '9:99', canonicalValue: '' });
  });

  it('uses one stable seven-step progress contract', () => {
    expect(getGeneralSignatureStepProgress('name')).toEqual({
      current: 1,
      total: 7,
      percentage: (1 / 7) * 100
    });
    expect(getGeneralSignatureStepProgress('question-two')).toEqual({
      current: 7,
      total: 7,
      percentage: 100
    });
  });
});
