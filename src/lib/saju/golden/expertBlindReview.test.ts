import { describe, expect, it } from 'vitest';
import { generalSignatureGoldenFixtures } from './fixtures';
import { createExpertBlindReviewRows } from './expertBlindReview';

describe('general signature expert blind-review package', () => {
  it('selects exactly 50 distributed fixtures without revealing current interpretation conclusions', () => {
    const rows = createExpertBlindReviewRows(generalSignatureGoldenFixtures);
    expect(rows).toHaveLength(50);
    expect(new Set(rows.map((row) => row.fixtureId)).size).toBe(50);
    expect(rows.every((row) => row.expertAUsefulElement === '' && row.expertBUsefulElement === '')).toBe(true);
    expect(JSON.stringify(rows)).not.toMatch(/helpfulElements|cautiousElements|용신 결론|신강|신약/);
  });
});
