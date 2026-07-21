import { describe, expect, it } from 'vitest';
import {
  PRODUCT_STATUS,
  SERVER_PRODUCT_CATALOG,
  assertProductAvailableForExistingAccess,
  assertProductAvailableForNewOrder,
  getCatalogAmount,
  getManifestStatus,
  isProductAvailableForExistingAccess,
  type ServerProductCatalog
} from '../../cloudrun-api/src/contracts/products.ts';
import productManifest from './manifest.json';
import { activeProducts, productRegistry } from './registry';
import { productIds } from './types';

const draftCatalog: ServerProductCatalog = {
  ...SERVER_PRODUCT_CATALOG,
  'concern-reading': {
    ...SERVER_PRODUCT_CATALOG['concern-reading'],
    status: PRODUCT_STATUS.DRAFT
  }
};

function captureError(action: () => unknown) {
  try {
    action();
  } catch (error) {
    return error;
  }

  throw new Error('Expected the product policy to reject the request.');
}

describe('server product sale status contract', () => {
  it('uses the shared product statuses for new-order availability', () => {
    const serverActiveIds = productIds.filter(
      (productId) => SERVER_PRODUCT_CATALOG[productId].status === 'active'
    );

    expect(serverActiveIds).toEqual(activeProducts.map((product) => product.id));
    productIds.forEach((productId) => {
      expect(SERVER_PRODUCT_CATALOG[productId].status).toBe(productManifest[productId]);
    });
  });

  it.each([
    PRODUCT_STATUS.ACTIVE,
    PRODUCT_STATUS.DRAFT,
    PRODUCT_STATUS.ARCHIVED
  ])('recognizes %s as an official server product status', (status) => {
    expect(
      getManifestStatus('fixture-product', {
        'fixture-product': status
      })
    ).toBe(status);
  });

  it('rejects unsupported manifest statuses', () => {
    expect(() =>
      getManifestStatus('fixture-product', {
        'fixture-product': 'unknown'
      })
    ).toThrow('unsupported status');
  });

  it('keeps active orders available and rejects draft, archived, and unknown orders', () => {
    expect(() => assertProductAvailableForNewOrder('general-signature')).not.toThrow();
    expect(
      captureError(() => assertProductAvailableForNewOrder('life-flow'))
    ).toMatchObject({ status: 409 });
    expect(
      captureError(() =>
        assertProductAvailableForNewOrder('concern-reading', draftCatalog)
      )
    ).toMatchObject({ status: 409 });
    expect(
      captureError(() => assertProductAvailableForNewOrder('unknown-product'))
    ).toMatchObject({ status: 400 });
  });

  it('limits existing payment recovery and entitlement lists to active and archived products', () => {
    expect(isProductAvailableForExistingAccess(PRODUCT_STATUS.ACTIVE)).toBe(true);
    expect(isProductAvailableForExistingAccess(PRODUCT_STATUS.ARCHIVED)).toBe(true);
    expect(isProductAvailableForExistingAccess(PRODUCT_STATUS.DRAFT)).toBe(false);
    expect(isProductAvailableForExistingAccess('unknown')).toBe(false);
    expect(
      captureError(() =>
        assertProductAvailableForExistingAccess('concern-reading', draftCatalog)
      )
    ).toMatchObject({ status: 409 });
  });

  it('keeps prices available for active and archived registered products', () => {
    productIds.forEach((productId) => {
      expect(getCatalogAmount(productId)).toBe(productRegistry[productId].price);
    });

    expect(() => getCatalogAmount('unknown-product')).toThrow();
  });

  it('retains every registered product and price in the server catalog', () => {
    expect(Object.keys(SERVER_PRODUCT_CATALOG).sort()).toEqual([...productIds].sort());

    productIds.forEach((productId) => {
      expect(SERVER_PRODUCT_CATALOG[productId]).toMatchObject({
        amount: productRegistry[productId].price,
        currency: productRegistry[productId].currency,
        status: productRegistry[productId].status
      });
    });
  });
});
