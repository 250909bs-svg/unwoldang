import { createHash } from 'node:crypto';
import { DATA_SCHEMA_VERSION, type ProductCatalogItemSnapshot } from './models.ts';

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function getProductCatalogHash(
  products: readonly ProductCatalogItemSnapshot[]
) {
  const canonicalProducts = [...products]
    .sort((left, right) => (
      left.productId < right.productId
        ? -1
        : left.productId > right.productId ? 1 : 0
    ))
    .map((product) => ({
      productId: product.productId,
      displayName: product.displayName,
      amount: product.amount,
      currency: product.currency,
      status: product.status
    }));

  return sha256(
    JSON.stringify({
      schemaVersion: DATA_SCHEMA_VERSION,
      products: canonicalProducts
    })
  );
}

export function getProductCatalogSnapshotId(
  catalogHash: string,
  effectiveAt: string
) {
  return sha256(
    `unwoldang:product-catalog-snapshot:v1:${catalogHash}:${effectiveAt}`
  );
}
