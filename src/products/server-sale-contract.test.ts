import { describe, expect, it } from 'vitest';
import {
  SERVER_PRODUCT_CATALOG,
  getCatalogAmount
} from '../../cloudrun-api/src/contracts/products.ts';
import productManifest from './manifest.json';
import { activeProducts, productRegistry } from './registry';
import { productIds } from './types';

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
