import { describe, expect, it } from 'vitest';
import { createLoveReadingProductShareData, LOVE_READING_PRODUCT_PATH } from './loveReadingShare';

describe('love-reading public product sharing', () => {
  it('shares the public product landing instead of a personalized report URL', () => {
    const shareData = createLoveReadingProductShareData('https://unwoldang.example');

    expect(shareData.url).toBe(`https://unwoldang.example${LOVE_READING_PRODUCT_PATH}`);
    expect(shareData.url).not.toContain('/report/');
    expect(shareData.title).not.toMatch(/님|리포트/);
    expect(shareData.text).not.toMatch(/생년|일간|명식|결과/);
  });

  it('keeps a safe relative landing path when no HTTP origin is available', () => {
    expect(createLoveReadingProductShareData().url).toBe(LOVE_READING_PRODUCT_PATH);
  });
});
