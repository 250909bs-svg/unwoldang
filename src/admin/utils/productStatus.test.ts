import { describe, expect, it } from 'vitest';
import { getAdminProductStatusLabel } from './productStatus';

describe('admin product status labels', () => {
  it('keeps sale, draft, archived, and unknown states distinct', () => {
    expect(getAdminProductStatusLabel('active')).toBe('판매 중');
    expect(getAdminProductStatusLabel('draft')).toBe('초안');
    expect(getAdminProductStatusLabel('archived')).toBe('판매 종료');
    expect(getAdminProductStatusLabel('unknown')).toBe('알 수 없음');
  });
});
