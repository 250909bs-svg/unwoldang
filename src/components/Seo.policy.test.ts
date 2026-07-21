import { describe, expect, it } from 'vitest';
import { resolveSeoPolicy } from './Seo';

type PolicyExpectation = {
  pathname: string;
  canonicalPath: string;
  shouldNoIndex: boolean;
  productId?: string;
};

const policies: PolicyExpectation[] = [
  {
    pathname: '/detail/general-saju',
    canonicalPath: '/detail/general-saju',
    shouldNoIndex: false,
    productId: 'general-signature'
  },
  {
    pathname: '/form/general-signature',
    canonicalPath: '/detail/general-saju',
    shouldNoIndex: true,
    productId: 'general-signature'
  },
  {
    pathname: '/report/past-life-goblin',
    canonicalPath: '/detail/past-life-goblin',
    shouldNoIndex: true,
    productId: 'past-life-goblin'
  },
  {
    pathname: '/preview/love-reading',
    canonicalPath: '/detail/love-reading',
    shouldNoIndex: true,
    productId: 'love-reading'
  },
  {
    pathname: '/detail/life-flow',
    canonicalPath: '/detail/life-flow',
    shouldNoIndex: true,
    productId: 'life-flow'
  },
  {
    pathname: '/form/life-flow',
    canonicalPath: '/detail/life-flow',
    shouldNoIndex: true,
    productId: 'life-flow'
  },
  {
    pathname: '/report/life-flow',
    canonicalPath: '/detail/life-flow',
    shouldNoIndex: true,
    productId: 'life-flow'
  },
  {
    pathname: '/detail/not-a-product',
    canonicalPath: '/',
    shouldNoIndex: true
  }
];

describe('runtime SEO product lifecycle policy', () => {
  it.each(policies)(
    'resolves $pathname to its canonical and robots policy',
    ({ pathname, canonicalPath, shouldNoIndex, productId }) => {
      const policy = resolveSeoPolicy(pathname);

      expect(policy.canonicalPath).toBe(canonicalPath);
      expect(policy.shouldNoIndex).toBe(shouldNoIndex);
      expect(policy.seoProduct?.id).toBe(productId);
      expect(policy.robots.startsWith(shouldNoIndex ? 'noindex' : 'index')).toBe(true);
    }
  );
});
