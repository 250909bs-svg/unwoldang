export const LOVE_READING_PRODUCT_PATH = '/detail/love-reading';

export type LoveReadingProductShareData = {
  title: string;
  text: string;
  url: string;
};

export function createLoveReadingProductShareData(origin?: string): LoveReadingProductShareData {
  const normalizedOrigin = origin?.trim();
  const url = normalizedOrigin && /^https?:\/\//i.test(normalizedOrigin)
    ? new URL(LOVE_READING_PRODUCT_PATH, normalizedOrigin).href
    : LOVE_READING_PRODUCT_PATH;

  return {
    title: 'MZ무당 팩폭 연애운 | 운월당',
    text: '반복되는 연애 패턴과 다음 인연의 기준을 살펴보는 운월당 연애운 상품이에요.',
    url
  };
}
