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
