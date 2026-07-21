import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import notFoundHandler from '../../api/not-found';
import retiredDetailHandler from '../../api/retired-detail';
import vercelConfig from '../../vercel.json';
import { PAST_LIFE_PRODUCT } from './pastLifeExperience';
import seoRouteData from './seoRoutes.json';
import { activeProducts, getProductByRoute, productRegistry } from '../products/registry';

const activeDetailPaths = ['/detail/general-saju', '/detail/love-reading', '/detail/love-reunion', '/detail/match-couple', '/detail/past-life-goblin'] as const;
const archivedDetailPaths = [
  '/detail/life-flow',
  '/detail/concern-reading',
  '/detail/match-destiny',
  '/detail/marriage-blueprint',
  '/detail/marriage-timing',
  '/detail/career-reading',
  '/detail/money-reading'
] as const;
const legacyUnknownDetailPaths = ['/detail/general-signature'] as const;
const archivedDetailPattern = `/detail/:id(${archivedDetailPaths.map((path) => path.slice('/detail/'.length)).join('|')})`;
const routeSeo = seoRouteData as Record<string, { indexable: boolean; serviceId?: string; price?: number }>;
const redirectedLegacyPaths = ['/menu', '/tarot'] as const;

describe('retired detail page indexing', () => {
  it('keeps only the five active product detail pages indexable', () => {
    const indexableDetailPaths = Object.entries(seoRouteData)
      .filter(([path, seo]) => path.startsWith('/detail/') && seo.indexable)
      .map(([path]) => path)
      .sort();

    expect(indexableDetailPaths).toEqual([...activeDetailPaths].sort());
    expect(activeProducts.map((product) => product.routes.detail).sort()).toEqual([...activeDetailPaths].sort());
    [...archivedDetailPaths, ...legacyUnknownDetailPaths].forEach((path) => {
      expect(routeSeo[path]?.indexable ?? false).toBe(false);
    });
  });

  it('keeps the five active detail rewrites on their static SEO pages', () => {
    const activeRewrites = new Map(
      vercelConfig.rewrites
        .filter((rewrite) => activeDetailPaths.includes(rewrite.source as (typeof activeDetailPaths)[number]))
        .map((rewrite) => [rewrite.source, rewrite.destination])
    );

    expect(activeRewrites.get('/detail/past-life-goblin')).toBe('/seo/detail-past-life-goblin.html');
    expect(activeRewrites.get('/detail/love-reading')).toBe('/seo/detail-love-reading.html');
    expect(activeRewrites.get('/detail/general-saju')).toBe('/seo/detail-general-saju.html');
    expect(activeRewrites.get('/detail/love-reunion')).toBe('/seo/detail-love-reunion.html');
    expect(activeRewrites.get('/detail/match-couple')).toBe('/seo/detail-match-couple.html');
    expect(vercelConfig.trailingSlash).toBe(false);
  });

  it('routes registered archived details to the SPA before the unmatched 410 fallback', () => {
    const archivedRewriteIndex = vercelConfig.rewrites.findIndex(
      (rewrite) => rewrite.source === archivedDetailPattern
    );
    const fallbackRewriteIndex = vercelConfig.rewrites.findIndex(
      (rewrite) => rewrite.source === '/detail/:path*'
    );

    expect(
      Object.values(productRegistry)
        .filter((product) => product.status === 'archived')
        .map((product) => product.routes.detail)
    ).toEqual(archivedDetailPaths);
    archivedDetailPaths.forEach((path) => {
      expect(getProductByRoute(path)?.status).toBe('archived');
    });
    expect(vercelConfig.rewrites[archivedRewriteIndex]).toEqual({
      source: archivedDetailPattern,
      destination: '/index.html'
    });
    expect(archivedRewriteIndex).toBeGreaterThanOrEqual(0);
    expect(fallbackRewriteIndex).toBeGreaterThan(archivedRewriteIndex);
    expect(vercelConfig.rewrites[fallbackRewriteIndex]).toEqual({
      source: '/detail/:path*',
      destination: '/api/retired-detail'
    });
    expect(vercelConfig.headers).toContainEqual({
      source: archivedDetailPattern,
      headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'Cache-Control', value: 'no-store' }
      ]
    });
    expect(vercelConfig.headers).toContainEqual({
      source: '/detail/past-life-goblin/:path(immersion|about)',
      headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'Cache-Control', value: 'no-store' }
      ]
    });
  });

  it('keeps SEO sale metadata aligned with the shared product registry', () => {
    activeProducts.forEach((product) => {
      expect(routeSeo[product.routes.detail]).toMatchObject({
        indexable: true,
        serviceId: product.id,
        price: product.price
      });
    });

    Object.values(productRegistry)
      .filter((product) => product.status === 'archived')
      .forEach((product) => {
        const seo = routeSeo[product.routes.detail];
        if (seo) {
          expect(seo.indexable).toBe(false);
        }
      });

    const generatorSource = readFileSync(new URL('../../scripts/generate-seo-pages.mjs', import.meta.url), 'utf8');
    expect(generatorSource).toContain("src', 'products', 'manifest.json");
    expect(generatorSource).toContain("=== 'active'");
  });

  it('permanently folds obsolete menu and tarot landings into the current home page', () => {
    redirectedLegacyPaths.forEach((path) => {
      expect(seoRouteData[path].indexable).toBe(false);
      expect(vercelConfig.redirects).toContainEqual({ source: path, destination: '/', permanent: true });
      expect(vercelConfig.rewrites.some((rewrite) => rewrite.source === path)).toBe(false);
    });
  });

  it('returns a hard 410 response with noindex headers', () => {
    const headers = new Map<string, string>();
    let statusCode = 0;
    let responseBody = '';
    const response = {
      setHeader(name: string, value: string) {
        headers.set(name, value);
      },
      status(code: number) {
        statusCode = code;
        return this;
      },
      send(body: string) {
        responseBody = body;
        return this;
      }
    };

    retiredDetailHandler({}, response);

    expect(statusCode).toBe(410);
    expect(headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(responseBody).toContain('이 페이지는 종료되었어요.');
  });

  it('returns a hard 404 with noindex for every unknown route', () => {
    const headers = new Map<string, string>();
    let statusCode = 0;
    let responseBody = '';
    const response = {
      setHeader(name: string, value: string) {
        headers.set(name, value);
      },
      status(code: number) {
        statusCode = code;
        return this;
      },
      send(body: string) {
        responseBody = body;
        return this;
      }
    };

    notFoundHandler({}, response);

    expect(statusCode).toBe(404);
    expect(headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(responseBody).toContain('페이지를 찾을 수 없어요.');
    expect(vercelConfig.rewrites.at(-1)).toEqual({ source: '/:path*', destination: '/api/not-found' });
  });

  it('ships the optimized general-saju artwork referenced by the landing page', () => {
    const publicDir = new URL('../../public/', import.meta.url);
    const webp = new URL('home-general-saju-card.webp', publicDir);
    const avif = new URL('home-general-saju-card.avif', publicDir);

    expect(existsSync(webp)).toBe(true);
    expect(existsSync(avif)).toBe(true);
    expect(statSync(webp).size).toBeLessThan(250_000);
    expect(statSync(avif).size).toBeLessThan(250_000);
  });

  it('serves the compressed past-life hero film instead of the 21MB original', () => {
    const optimizedFilm = new URL(`../../public${PAST_LIFE_PRODUCT.film}`, import.meta.url);

    expect(PAST_LIFE_PRODUCT.film).toBe('/media/dokkaebi-hero-optimized.mp4');
    expect(existsSync(optimizedFilm)).toBe(true);
    expect(statSync(optimizedFilm).size).toBeLessThan(5_000_000);
  });

  it('does not publish archived or unknown detail URLs in the sitemap', () => {
    const sitemap = readFileSync(new URL('../../public/sitemap.xml', import.meta.url), 'utf8');

    activeDetailPaths.forEach((path) => expect(sitemap).toContain(path));
    archivedDetailPaths.forEach((path) => expect(sitemap).not.toContain(path));
    legacyUnknownDetailPaths.forEach((path) => expect(sitemap).not.toContain(path));
    redirectedLegacyPaths.forEach((path) => expect(sitemap).not.toContain(`<loc>https://www.unwoldang.com${path}</loc>`));
  });
});
