import { describe, expect, it } from 'vitest';
import { maskEmail, maskName } from './masking';

describe('admin masking utilities', () => {
  it('masks names without exposing the middle characters', () => {
    expect(maskName('')).toBe('고객');
    expect(maskName('김')).toBe('김*');
    expect(maskName('김철')).toBe('김*');
    expect(maskName('홍길동')).toBe('홍*동');
  });

  it('masks email local parts and handles unavailable addresses', () => {
    expect(maskEmail()).toBe('카카오 이메일 미제공');
    expect(maskEmail('not-an-email')).toBe('카카오 이메일 미제공');
    expect(maskEmail('a@example.test')).toBe('a***@example.test');
    expect(maskEmail('sample@example.test')).toBe('sa***@example.test');
  });
});
