import { GENERAL_SIGNATURE_DETAIL_PATH, GENERAL_SIGNATURE_PRODUCT } from './product';

export type GeneralSignatureShareData = {
  title: string;
  text: string;
  url: string;
};

export function createGeneralSignatureShareData(origin?: string): GeneralSignatureShareData {
  let url: string = GENERAL_SIGNATURE_DETAIL_PATH;

  if (origin?.trim()) {
    try {
      const parsedOrigin = new URL(origin.trim());

      if (parsedOrigin.protocol === 'http:' || parsedOrigin.protocol === 'https:') {
        url = new URL(GENERAL_SIGNATURE_DETAIL_PATH, parsedOrigin.origin).href;
      }
    } catch {
      url = GENERAL_SIGNATURE_DETAIL_PATH;
    }
  }

  return {
    title: `${GENERAL_SIGNATURE_PRODUCT.displayName} | 운월당`,
    text: '기질·오행·십신부터 관계·직업·재물·연애·결혼, 대운·세운과 행동 가이드까지 한 번에 읽는 종합사주입니다.',
    url
  };
}
