import { describe, expect, it } from 'vitest';
import { findServiceById } from '../../api/mockData';
import {
  GENERAL_SIGNATURE_DETAIL_PATH,
  GENERAL_SIGNATURE_FORM_PATH,
  GENERAL_SIGNATURE_ID,
  GENERAL_SIGNATURE_PRODUCT,
  GENERAL_SIGNATURE_REPORT_PATH
} from './product';
import { GENERAL_SIGNATURE_SEO, GENERAL_SIGNATURE_SEO_PATH } from './seo';
import { createGeneralSignatureShareData } from './share';

describe('general-signature product contract', () => {
  it('keeps the contracted id, name, price, and public paths', () => {
    const service = findServiceById(GENERAL_SIGNATURE_ID);

    expect(GENERAL_SIGNATURE_ID).toBe('general-signature');
    expect(GENERAL_SIGNATURE_PRODUCT.displayName).toBe('운월선생 정통 종합사주');
    expect(service.label).toBe(GENERAL_SIGNATURE_PRODUCT.displayName);
    expect(service.price).toBe('79,000원');
    expect(GENERAL_SIGNATURE_DETAIL_PATH).toBe('/detail/general-saju');
    expect(GENERAL_SIGNATURE_FORM_PATH).toBe('/form/general-signature');
    expect(GENERAL_SIGNATURE_REPORT_PATH).toBe('/report/general-signature');
  });

  it('connects every required report topic in one ordered map', () => {
    expect(GENERAL_SIGNATURE_PRODUCT.report.tracks.map((track) => track.label)).toEqual([
      '기질',
      '오행',
      '십신',
      '관계',
      '직업',
      '재물',
      '연애·결혼',
      '대운·세운',
      '질문 2개',
      '행동 가이드'
    ]);
    expect(GENERAL_SIGNATURE_PRODUCT.detail.readingAreas).toHaveLength(9);
    expect(GENERAL_SIGNATURE_PRODUCT.detail.reportChapters).toHaveLength(10);
    expect(GENERAL_SIGNATURE_PRODUCT.report.tracks.map((track) => track.anchor)).toEqual([
      'trait',
      'element',
      'ten',
      'detailRel',
      'career',
      'money',
      'love',
      'fortune',
      'qa',
      'plan'
    ]);
    expect(GENERAL_SIGNATURE_PRODUCT.intake.questionSuggestions.q1.length).toBeGreaterThanOrEqual(3);
    expect(GENERAL_SIGNATURE_PRODUCT.intake.questionSuggestions.q2.length).toBeGreaterThanOrEqual(3);
  });

  it('owns the canonical SEO metadata without changing the product contract', () => {
    expect(GENERAL_SIGNATURE_SEO_PATH).toBe(GENERAL_SIGNATURE_DETAIL_PATH);
    expect(GENERAL_SIGNATURE_SEO.serviceId).toBe(GENERAL_SIGNATURE_ID);
    expect(GENERAL_SIGNATURE_SEO.productName).toBe(GENERAL_SIGNATURE_PRODUCT.displayName);
    expect(GENERAL_SIGNATURE_SEO.price).toBe(79000);
    expect(GENERAL_SIGNATURE_SEO.priceCurrency).toBe('KRW');
    expect(GENERAL_SIGNATURE_SEO.indexable).toBe(true);
    expect(JSON.stringify(GENERAL_SIGNATURE_SEO)).toContain('시간 미상');
    expect(JSON.stringify(GENERAL_SIGNATURE_SEO)).toContain('윤달');
    expect(JSON.stringify(GENERAL_SIGNATURE_SEO)).toContain('23시');
  });
});

describe('general-signature product sharing', () => {
  it('shares only the public product page without personal report data', () => {
    const shareData = createGeneralSignatureShareData('https://www.unwoldang.com/report/general-signature?order=private#result');
    const serialized = JSON.stringify(shareData);

    expect(shareData.url).toBe('https://www.unwoldang.com/detail/general-saju');
    expect(shareData.url).not.toContain('/report/');
    expect(serialized).not.toContain('order=');
    expect(serialized).not.toMatch(/생년월일|고객님|주문/);
  });

  it('falls back to the public relative path for invalid or non-http origins', () => {
    expect(createGeneralSignatureShareData().url).toBe(GENERAL_SIGNATURE_DETAIL_PATH);
    expect(createGeneralSignatureShareData('not-a-url').url).toBe(GENERAL_SIGNATURE_DETAIL_PATH);
    expect(createGeneralSignatureShareData('ftp://private.example').url).toBe(GENERAL_SIGNATURE_DETAIL_PATH);
  });
});
