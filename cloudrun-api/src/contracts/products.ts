import productManifest from '../../../src/products/manifest.json';
import { PaymentRequestError } from './errors.ts';

export const PRODUCT_STATUS = Object.freeze({
  ACTIVE: 'active',
  DRAFT: 'draft',
  ARCHIVED: 'archived'
} as const);

export type ProductStatus = (typeof PRODUCT_STATUS)[keyof typeof PRODUCT_STATUS];

export type ServerProductContract = Readonly<{
  amount: number;
  currency: 'KRW';
  status: ProductStatus;
}>;

export type ServerProductCatalog = Readonly<Record<string, ServerProductContract>>;

export function isProductStatus(status: unknown): status is ProductStatus {
  return (
    status === PRODUCT_STATUS.ACTIVE ||
    status === PRODUCT_STATUS.DRAFT ||
    status === PRODUCT_STATUS.ARCHIVED
  );
}

export function getManifestStatus(
  productId: string,
  manifest: Readonly<Record<string, unknown>> = productManifest
): ProductStatus {
  const status = manifest[productId];

  if (!isProductStatus(status)) {
    throw new Error(`Server product catalog has an unsupported status for "${productId}".`);
  }

  return status;
}

export const SERVER_PRODUCT_CATALOG = Object.freeze({
  'general-signature': { amount: 79_000, currency: 'KRW', status: getManifestStatus('general-signature') },
  'life-flow': { amount: 59_000, currency: 'KRW', status: getManifestStatus('life-flow') },
  'concern-reading': { amount: 2_900, currency: 'KRW', status: getManifestStatus('concern-reading') },
  'past-life-goblin': { amount: 49_000, currency: 'KRW', status: getManifestStatus('past-life-goblin') },
  'love-reading': { amount: 49_000, currency: 'KRW', status: getManifestStatus('love-reading') },
  'love-reunion': { amount: 55_000, currency: 'KRW', status: getManifestStatus('love-reunion') },
  'match-couple': { amount: 69_000, currency: 'KRW', status: getManifestStatus('match-couple') },
  'match-destiny': { amount: 63_000, currency: 'KRW', status: getManifestStatus('match-destiny') },
  'marriage-blueprint': { amount: 72_000, currency: 'KRW', status: getManifestStatus('marriage-blueprint') },
  'marriage-timing': { amount: 58_000, currency: 'KRW', status: getManifestStatus('marriage-timing') },
  'career-reading': { amount: 59_000, currency: 'KRW', status: getManifestStatus('career-reading') },
  'money-reading': { amount: 59_000, currency: 'KRW', status: getManifestStatus('money-reading') }
} as const);

export type ProductId = keyof typeof SERVER_PRODUCT_CATALOG;

export const SERVER_PRODUCT_DISPLAY_NAMES = Object.freeze({
  'general-signature': '운월선생 정통 종합사주',
  'life-flow': '운월선생 신년운세',
  'concern-reading': '운월당 고민풀이',
  'past-life-goblin': 'MZ 도깨비 전생사주',
  'love-reading': 'MZ무당 팩폭 연애운',
  'love-reunion': '홍연아씨 재회 가능성',
  'match-couple': '월연도령 사주궁합',
  'match-destiny': '월연도령 운명 궁합',
  'marriage-blueprint': '청연부인 결혼운 설계도',
  'marriage-timing': '청연부인 혼인 시기 리포트',
  'career-reading': '운월선생 직업운 설계도',
  'money-reading': '운월선생 금전운 설계도'
} as const satisfies Readonly<Record<ProductId, string>>);

export function getProductContract(
  productId: string,
  catalog: ServerProductCatalog = SERVER_PRODUCT_CATALOG
) {
  const product = catalog[productId];

  if (!product || !Number.isSafeInteger(product.amount) || product.amount <= 0) {
    throw new PaymentRequestError(400, '서버 상품표에서 확인할 수 없는 productId입니다.');
  }

  return product;
}

export function getCatalogAmount(
  productId: string,
  catalog: ServerProductCatalog = SERVER_PRODUCT_CATALOG
) {
  return getProductContract(productId, catalog).amount;
}

export function isProductAvailableForExistingAccess(status: unknown) {
  return status === PRODUCT_STATUS.ACTIVE || status === PRODUCT_STATUS.ARCHIVED;
}

export function assertProductAvailableForExistingAccess(
  productId: string,
  catalog: ServerProductCatalog = SERVER_PRODUCT_CATALOG
) {
  const product = getProductContract(productId, catalog);

  if (!isProductAvailableForExistingAccess(product.status)) {
    throw new PaymentRequestError(
      409,
      'This product is not available for existing payment or entitlement access.'
    );
  }
}

export function assertProductAvailableForNewOrder(
  productId: string,
  catalog: ServerProductCatalog = SERVER_PRODUCT_CATALOG
) {
  const product = getProductContract(productId, catalog);

  if (product.status !== PRODUCT_STATUS.ACTIVE) {
    throw new PaymentRequestError(409, '현재 신규 판매 중인 상품이 아닙니다.');
  }
}
