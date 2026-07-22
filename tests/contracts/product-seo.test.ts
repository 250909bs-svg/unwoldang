import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  assertProductAvailableForExistingAccess,
  assertProductAvailableForNewOrder,
  getProductContract,
  PRODUCT_STATUS,
  type ServerProductCatalog
} from '../../cloudrun-api/src/contracts/products';
import { buildStructuredData, resolveSeoPolicy } from '../../src/components/Seo';
import { activeProducts, productRegistry } from '../../src/products/registry';

const SITE_URL = 'https://www.unwoldang.com';

const syntheticCatalog = {
  active: { amount: 1_000, currency: 'KRW', status: PRODUCT_STATUS.ACTIVE },
  draft: { amount: 2_000, currency: 'KRW', status: PRODUCT_STATUS.DRAFT },
  archived: { amount: 3_000, currency: 'KRW', status: PRODUCT_STATUS.ARCHIVED }
} as const satisfies ServerProductCatalog;

function expectPaymentStatus(run: () => unknown, status: number) {
  try {
    run();
  } catch (error) {
    expect(error).toMatchObject({ status });
    return;
  }

  throw new Error(`Expected a payment contract error with status ${status}.`);
}

function countOccurrences(value: string, fragment: string) {
  return value.split(fragment).length - 1;
}

function graphFrom(pathname: string) {
  const policy = resolveSeoPolicy(pathname);
  const canonicalUrl = `${SITE_URL}${policy.canonicalPath === '/' ? '/' : policy.canonicalPath}`;
  const imageUrl = `${SITE_URL}${policy.seo.image}`;
  const structuredData = buildStructuredData(
    policy.seoPath ?? policy.path,
    policy.seo,
    canonicalUrl,
    imageUrl
  );

  return {
    policy,
    canonicalUrl,
    graph: structuredData['@graph'] as Array<Record<string, unknown>>
  };
}

describe('server product lifecycle contract', () => {
  it('allows active products for both new and existing access', () => {
    expect(() => assertProductAvailableForNewOrder('active', syntheticCatalog)).not.toThrow();
    expect(() => assertProductAvailableForExistingAccess('active', syntheticCatalog)).not.toThrow();
  });

  it('rejects draft products for both new and existing access', () => {
    expectPaymentStatus(() => assertProductAvailableForNewOrder('draft', syntheticCatalog), 409);
    expectPaymentStatus(() => assertProductAvailableForExistingAccess('draft', syntheticCatalog), 409);
  });

  it('rejects archived products for new orders but allows existing access', () => {
    expectPaymentStatus(() => assertProductAvailableForNewOrder('archived', syntheticCatalog), 409);
    expect(() => assertProductAvailableForExistingAccess('archived', syntheticCatalog)).not.toThrow();
  });

  it('rejects unknown products with status 400', () => {
    expectPaymentStatus(() => getProductContract('unknown', syntheticCatalog), 400);
    expectPaymentStatus(() => assertProductAvailableForNewOrder('unknown', syntheticCatalog), 400);
    expectPaymentStatus(() => assertProductAvailableForExistingAccess('unknown', syntheticCatalog), 400);
  });
});

describe('active product SEO contract', () => {
  const sitemap = readFileSync(new URL('../../public/sitemap.xml', import.meta.url), 'utf8');

  it.each(activeProducts)('binds $id Product JSON-LD to the registry contract', (product) => {
    const { policy, canonicalUrl, graph } = graphFrom(product.routes.detail);
    const productNode = graph.find((item) => item['@type'] === 'Product');
    const offers = productNode?.offers as Record<string, unknown> | undefined;

    expect(policy.shouldNoIndex).toBe(false);
    expect(policy.seoProduct?.id).toBe(product.id);
    expect(productNode).toMatchObject({
      '@type': 'Product',
      name: product.displayName,
      url: canonicalUrl
    });
    expect(offers).toMatchObject({
      '@type': 'Offer',
      url: canonicalUrl,
      price: String(product.price),
      priceCurrency: product.currency
    });
  });

  it('publishes active details exactly once and excludes archived and unknown details', () => {
    activeProducts.forEach((product) => {
      const location = `<loc>${SITE_URL}${product.routes.detail}</loc>`;
      expect(countOccurrences(sitemap, location)).toBe(1);
    });

    Object.values(productRegistry)
      .filter((product) => product.status === PRODUCT_STATUS.ARCHIVED)
      .forEach((product) => {
        const location = `<loc>${SITE_URL}${product.routes.detail}</loc>`;
        expect(countOccurrences(sitemap, location)).toBe(0);
      });

    expect(countOccurrences(sitemap, `<loc>${SITE_URL}/detail/unknown-product</loc>`)).toBe(0);
  });

  it('lists only the five active products in the home ItemList', () => {
    const { graph } = graphFrom('/');
    const itemList = graph.find((item) => item['@type'] === 'ItemList');
    const entries = itemList?.itemListElement as Array<Record<string, unknown>> | undefined;
    const expectedUrls = activeProducts.map((product) => `${SITE_URL}${product.routes.detail}`);

    expect(entries).toHaveLength(5);
    expect(entries?.map((entry) => entry.url)).toEqual(expectedUrls);
    expect(new Set(entries?.map((entry) => entry.url))).toEqual(new Set(expectedUrls));
  });
});
