import { describe, expect, it } from 'vitest';
import { activeProducts, productRegistry } from '../products/registry';
import type { ProductDefinition } from '../products/types';
import seoRouteData from './seoRoutes.json';
import {
  buildSeoDocument,
  INDEX_ROBOTS,
  NOINDEX_ROBOTS,
  type RouteSeoContent,
  type SeoDocument
} from './seoDocument';

const SITE_URL = 'https://www.unwoldang.com';
const seoByPath = seoRouteData as unknown as Record<string, RouteSeoContent>;
const safeFaqFixture = {
  question: '이 항목은 무엇을 검증하나요?',
  answer: '구조화 데이터 생성을 검증하기 위한 테스트 전용 FAQ입니다.'
};

function seoForPath(path: string): RouteSeoContent {
  const seo = seoByPath[path];

  if (!seo) {
    throw new Error(`Missing SEO fixture for ${path}`);
  }

  return seo;
}

function seoForProduct(product: ProductDefinition): RouteSeoContent {
  const seo = seoByPath[product.routes.detail] ?? {
    ...seoForPath('/'),
    title: product.search.title,
    image: product.search.image,
    heading: product.displayName,
    indexable: product.status === 'active'
  };

  return {
    ...seo,
    faqs: seo.faqs?.length ? seo.faqs : [safeFaqFixture]
  };
}

function buildForProduct(
  product: ProductDefinition,
  requestedPath = product.routes.detail,
  shouldNoIndex = false
) {
  return buildSeoDocument({
    siteUrl: `${SITE_URL}/`,
    requestedPath,
    canonicalPath: product.routes.detail,
    seo: seoForProduct(product),
    product,
    activeProducts,
    shouldNoIndex
  });
}

function nodesOfType(document: SeoDocument, type: string) {
  return document.structuredData['@graph'].filter((node) => node['@type'] === type);
}

function expectNoProductRichResults(document: SeoDocument) {
  expect(document.robots).toBe(NOINDEX_ROBOTS);
  expect(document.isCanonicalActiveDetail).toBe(false);
  expect(document.openGraph.type).toBe('website');
  expect(document.openGraph.priceAmount).toBeUndefined();
  expect(document.openGraph.priceCurrency).toBeUndefined();
  expect(nodesOfType(document, 'Product')).toHaveLength(0);
  expect(nodesOfType(document, 'FAQPage')).toHaveLength(0);
}

describe('shared SEO document builder', () => {
  it('builds the home ItemList from the five active products in registry order', () => {
    const document = buildSeoDocument({
      siteUrl: `${SITE_URL}/`,
      requestedPath: '/',
      canonicalPath: '/',
      seo: seoForPath('/'),
      activeProducts,
      shouldNoIndex: false
    });
    const [itemList] = nodesOfType(document, 'ItemList');

    expect(activeProducts).toHaveLength(5);
    expect(nodesOfType(document, 'ItemList')).toHaveLength(1);
    expect(itemList.itemListElement).toEqual(
      activeProducts.map((product, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: product.displayName,
        url: `${SITE_URL}${product.routes.detail}`
      }))
    );
  });

  it.each([...activeProducts])(
    'keeps the $id canonical product document aligned with the registry',
    (product) => {
      const seo = seoForProduct(product);
      const document = buildForProduct(product);
      const canonicalUrl = `${SITE_URL}${product.routes.detail}`;
      const imageUrl = `${SITE_URL}${product.search.image}`;
      const [productNode] = nodesOfType(document, 'Product');
      const [faqNode] = nodesOfType(document, 'FAQPage');

      expect(document.robots).toBe(INDEX_ROBOTS);
      expect(document.isCanonicalActiveDetail).toBe(true);
      expect(document.canonicalUrl).toBe(canonicalUrl);
      expect(document.imageUrl).toBe(imageUrl);
      expect(document.openGraph).toMatchObject({
        type: 'product',
        title: product.displayName,
        url: canonicalUrl,
        image: imageUrl,
        priceAmount: String(product.price),
        priceCurrency: product.currency
      });
      expect(document.twitter).toMatchObject({
        card: 'summary_large_image',
        title: product.displayName,
        image: imageUrl
      });
      expect(document.alternates).toEqual([
        { id: 'route-hreflang-ko', hreflang: 'ko-KR', href: canonicalUrl },
        { id: 'route-hreflang-default', hreflang: 'x-default', href: canonicalUrl }
      ]);

      expect(nodesOfType(document, 'Product')).toHaveLength(1);
      expect(productNode).toMatchObject({
        '@type': 'Product',
        sku: product.id,
        name: product.displayName,
        url: canonicalUrl,
        image: imageUrl,
        offers: {
          '@type': 'Offer',
          url: canonicalUrl,
          price: String(product.price),
          priceCurrency: product.currency
        }
      });
      expect(nodesOfType(document, 'FAQPage')).toHaveLength(1);
      expect(faqNode.mainEntity).toEqual(
        seo.faqs?.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer
          }
        }))
      );
    }
  );

  it.each(
    activeProducts.flatMap((product) => [
      { product, label: 'form', path: product.routes.intake },
      { product, label: 'report', path: product.routes.report },
      ...(product.routes.preview
        ? [{ product, label: 'preview', path: product.routes.preview }]
        : [])
    ])
  )('enforces noindex for the $label alias $path without trusting its caller', ({ product, path }) => {
    const document = buildForProduct(product, path, false);

    expect(document.canonicalUrl).toBe(`${SITE_URL}${product.routes.detail}`);
    expectNoProductRichResults(document);
  });

  it.each(
    Object.values(productRegistry).filter((product) => product.status === 'archived')
  )('enforces noindex for the archived $id detail from registry status', (product) => {
    expectNoProductRichResults(buildForProduct(product, product.routes.detail, false));
  });

  it('keeps an unknown detail noindex without product rich results', () => {
    const document = buildSeoDocument({
      siteUrl: SITE_URL,
      requestedPath: '/detail/not-a-product',
      canonicalPath: '/',
      seo: { ...seoForPath('/'), faqs: [safeFaqFixture] },
      activeProducts,
      shouldNoIndex: true
    });

    expect(document.canonicalUrl).toBe(`${SITE_URL}/`);
    expectNoProductRichResults(document);
  });

  it('does not emit FAQPage for a non-product page even when FAQ content is provided', () => {
    const document = buildSeoDocument({
      siteUrl: SITE_URL,
      requestedPath: '/test',
      canonicalPath: '/test',
      seo: { ...seoForPath('/test'), faqs: [safeFaqFixture] },
      activeProducts,
      shouldNoIndex: false
    });

    expect(document.robots).toBe(INDEX_ROBOTS);
    expect(document.openGraph.type).toBe('website');
    expect(nodesOfType(document, 'Product')).toHaveLength(0);
    expect(nodesOfType(document, 'FAQPage')).toHaveLength(0);
  });
});
