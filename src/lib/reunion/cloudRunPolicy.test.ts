import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Cloud Run reunion fallback policy', () => {
  const source = readFileSync(
    new URL('../../../cloudrun-api/src/domains/reports/reportService.ts', import.meta.url),
    'utf8'
  );

  it('caches the deterministic reunion report even when Gemini narration falls back', () => {
    expect(source).toContain(
      "payload.provider === 'deterministic-fallback' && claims.productId !== 'love-reunion'"
    );
  });
});
