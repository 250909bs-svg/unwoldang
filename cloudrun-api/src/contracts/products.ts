import { PaymentRequestError } from './errors.ts';

export const PRODUCT_STATUS = Object.freeze({
  ACTIVE: 'active'
} as const);

export type ProductStatus = (typeof PRODUCT_STATUS)[keyof typeof PRODUCT_STATUS];

export const SERVER_PRODUCT_CATALOG = Object.freeze({
  'general-signature': { amount: 79_000, currency: 'KRW', status: PRODUCT_STATUS.ACTIVE },
  'life-flow': { amount: 59_000, currency: 'KRW', status: PRODUCT_STATUS.ACTIVE },
  'concern-reading': { amount: 2_900, currency: 'KRW', status: PRODUCT_STATUS.ACTIVE },
  'past-life-goblin': { amount: 49_000, currency: 'KRW', status: PRODUCT_STATUS.ACTIVE },
  'love-reading': { amount: 49_000, currency: 'KRW', status: PRODUCT_STATUS.ACTIVE },
  'love-reunion': { amount: 55_000, currency: 'KRW', status: PRODUCT_STATUS.ACTIVE },
  'match-couple': { amount: 69_000, currency: 'KRW', status: PRODUCT_STATUS.ACTIVE },
  'match-destiny': { amount: 63_000, currency: 'KRW', status: PRODUCT_STATUS.ACTIVE },
  'marriage-blueprint': { amount: 72_000, currency: 'KRW', status: PRODUCT_STATUS.ACTIVE },
  'marriage-timing': { amount: 58_000, currency: 'KRW', status: PRODUCT_STATUS.ACTIVE },
  'career-reading': { amount: 59_000, currency: 'KRW', status: PRODUCT_STATUS.ACTIVE },
  'money-reading': { amount: 59_000, currency: 'KRW', status: PRODUCT_STATUS.ACTIVE }
} as const);

export type ProductId = keyof typeof SERVER_PRODUCT_CATALOG;

export function getProductContract(productId: string) {
  const product = SERVER_PRODUCT_CATALOG[productId as ProductId];

  if (!product || product.status !== PRODUCT_STATUS.ACTIVE || !Number.isSafeInteger(product.amount) || product.amount <= 0) {
    throw new PaymentRequestError(400, '서버 상품표에서 확인할 수 없는 productId입니다.');
  }

  return product;
}

export function getCatalogAmount(productId: string) {
  return getProductContract(productId).amount;
}
