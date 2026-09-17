import { describe, expect, it } from 'vitest';
import productManifest from './manifest.json';
import {
  activeProducts,
  canDiscoverProduct,
  canIndexProduct,
  canPurchaseProduct,
  canReadHistoricalReport,
  canStartProduct,
  discoverableProducts,
  getProductById,
  getProductByRoute,
  getProductIdByRoute,
  isProductActive,
  isLocalPreviewRuntime,
  isLocalPreviewProduct,
  isLoopbackPreviewHostname,
  productRegistry
} from './registry';
import { productIds, productStatuses } from './types';

const activeIds = ['general-signature'] as const;

const archivedIds = [
  'life-flow',
  'concern-reading',
  'past-life-goblin',
  'love-reading',
  'love-reunion',
  'match-couple',
  'match-destiny',
  'marriage-blueprint',
  'marriage-timing',
  'career-reading',
  'money-reading'
] as const;

describe('product registry contract', () => {
  it('defines the complete status vocabulary and exact active/archive partition', () => {
    expect(productStatuses).toEqual(['active', 'draft', 'archived']);
    expect(Object.keys(productManifest).sort()).toEqual([...productIds].sort());
    expect(activeProducts.map((product) => product.id)).toEqual(activeIds);
    expect(productIds.filter((id) => productRegistry[id].status === 'archived')).toEqual(archivedIds);
    expect(productIds.filter((id) => productRegistry[id].status === 'draft')).toEqual([]);
  });

  it('uses active status for every new-sale capability', () => {
    activeIds.forEach((id) => {
      expect(isProductActive(id)).toBe(true);
      expect(canDiscoverProduct(id)).toBe(true);
      expect(canStartProduct(id)).toBe(true);
      expect(canPurchaseProduct(id)).toBe(true);
      expect(canIndexProduct(id)).toBe(true);
    });

    const localPreviewIds = ['love-reading', 'love-reunion', 'past-life-goblin'];

    archivedIds.forEach((id) => {
      expect(isProductActive(id)).toBe(false);
      expect(canDiscoverProduct(id)).toBe(localPreviewIds.includes(id));
      expect(canStartProduct(id)).toBe(localPreviewIds.includes(id));
      expect(canPurchaseProduct(id)).toBe(false);
      expect(canIndexProduct(id)).toBe(false);
    });
  });

  it('keeps archived MZ love reading, reunion and past life available only in local preview', () => {
    expect(import.meta.env.DEV).toBe(true);
    expect(isLocalPreviewProduct('love-reading')).toBe(true);
    expect(isLocalPreviewProduct('past-life-goblin')).toBe(true);
    expect(discoverableProducts.map((product) => product.id)).toEqual([
      'general-signature',
      'past-life-goblin',
      'love-reading',
      'love-reunion'
    ]);
    expect(canPurchaseProduct('love-reading')).toBe(false);
    expect(canPurchaseProduct('love-reunion')).toBe(false);
    expect(canPurchaseProduct('past-life-goblin')).toBe(false);
    expect(canIndexProduct('love-reading')).toBe(false);
    expect(canIndexProduct('love-reunion')).toBe(false);
    expect(canIndexProduct('past-life-goblin')).toBe(false);
  });

  it('keeps built local previews on loopback without exposing archived products on production hosts', () => {
    expect(isLoopbackPreviewHostname('localhost')).toBe(true);
    expect(isLoopbackPreviewHostname('127.0.0.1')).toBe(true);
    expect(isLoopbackPreviewHostname('::1')).toBe(true);
    expect(isLoopbackPreviewHostname('[::1]')).toBe(true);
    expect(isLocalPreviewRuntime({ isDevelopment: false, hostname: '127.0.0.1' })).toBe(true);
    expect(isLocalPreviewRuntime({ isDevelopment: false, hostname: 'www.unwoldang.com' })).toBe(false);
    expect(isLocalPreviewRuntime({ isDevelopment: true, hostname: 'www.unwoldang.com' })).toBe(true);
  });

  it('keeps historical report reads for archived products without accepting unknown IDs', () => {
    [...activeIds, ...archivedIds].forEach((id) => {
      expect(canReadHistoricalReport(id)).toBe(true);
    });

    expect(getProductById('unknown-product')).toBeUndefined();
    expect(isProductActive('unknown-product')).toBe(false);
    expect(canDiscoverProduct('unknown-product')).toBe(false);
    expect(canStartProduct('unknown-product')).toBe(false);
    expect(canPurchaseProduct('unknown-product')).toBe(false);
    expect(canIndexProduct('unknown-product')).toBe(false);
    expect(canReadHistoricalReport('unknown-product')).toBe(false);
  });

  it('preserves canonical routes and resolves product-owned routes', () => {
    expect(productRegistry['general-signature'].routes.detail).toBe('/detail/general-saju');
    expect(getProductIdByRoute('/detail/general-saju')).toBe('general-signature');
    expect(getProductByRoute('/detail/general-saju/')?.id).toBe('general-signature');
    expect(getProductByRoute('/form/love-reading?from=detail')?.id).toBe('love-reading');
    expect(getProductByRoute('/preview/love-reading')?.id).toBe('love-reading');
    expect(getProductByRoute('/detail/past-life-goblin/immersion')?.id).toBe('past-life-goblin');
    expect(getProductByRoute('/detail/general-signature')).toBeUndefined();
    expect(getProductByRoute('/checkout')).toBeUndefined();
  });

  it('declares partner birth requirements in the flow adapter', () => {
    const partnerBirthProducts = productIds.filter(
      (id) => productRegistry[id].flow.requiresPartnerBirth
    );

    expect(partnerBirthProducts).toEqual(['love-reunion', 'match-couple', 'match-destiny']);
    expect(productRegistry['past-life-goblin'].flow.intakeVariant).toBe('past-life');
    expect(productRegistry['love-reading'].flow.intakeVariant).toBe('love-reading');
  });
});
