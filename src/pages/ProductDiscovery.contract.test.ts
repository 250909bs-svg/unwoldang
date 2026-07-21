import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { activeProducts, getProductById } from '../products/registry';

const homeSource = readFileSync(new URL('./Home.tsx', import.meta.url), 'utf8');
const menuSource = readFileSync(new URL('./Menu.tsx', import.meta.url), 'utf8');
const mySource = readFileSync(new URL('./My.tsx', import.meta.url), 'utf8');
const searchSource = readFileSync(new URL('./Search.tsx', import.meta.url), 'utf8');

describe('product discovery source contract', () => {
  it('derives menu products, categories, and links from the shared registry', () => {
    expect(menuSource).toContain('canDiscoverProduct(service.id)');
    expect(menuSource).toContain('discoverableServiceCategories');
    expect(menuSource).toContain("category.id === 'all'");
    expect(menuSource).toContain('getProductById(service.id).routes.detail');
    expect(menuSource).not.toContain('return serviceCatalog;');
    expect(menuSource).not.toContain('to={`/form/${service.id}`}');
  });

  it('adds every active product module to the default Home and Search collections', () => {
    expect(activeProducts.length).toBeGreaterThan(0);

    activeProducts.forEach((product) => {
      expect(product.home.title).toBeTruthy();
      expect(product.home.subtitle).toBeTruthy();
      expect(product.home.image).toBeTruthy();
      expect(product.search.title).toBeTruthy();
      expect(product.search.image).toBeTruthy();
      expect(product.search.keywords.length).toBeGreaterThan(0);
      expect(product.routes.detail).toBeTruthy();
    });

    expect(homeSource).toContain('const homeProductCards = activeProducts.map((product) => ({');
    expect(homeSource).toContain('...product.home');
    expect(homeSource).toContain('to: product.routes.detail');
    expect(searchSource).toContain(
      'const searchProducts: SearchProduct[] = activeProducts.map((product) => ({'
    );
    expect(searchSource).toContain('...product.search');
    expect(searchSource).toContain('to: product.routes.detail');
    expect(homeSource).not.toContain('const homeProductCards: HomeProductCard[] = [');
    expect(searchSource).not.toContain('const searchProducts: SearchProduct[] = [');
  });

  it('keeps presentation options in modules and normalizes curated Home links', () => {
    expect(getProductById('past-life-goblin').home.artworkTitle).toBe(true);
    expect(getProductById('love-reading').home.artworkTitle).toBe(true);
    expect(getProductById('love-reading').home.fullPoster).toBe(true);
    expect(getProductById('love-reunion').routes.detail).toBe('/detail/love-reunion');
    expect(getProductById('match-couple').routes.detail).toBe('/detail/match-couple');
    expect(homeSource).toContain('to: getProductById(slide.target).routes.detail');
    expect(homeSource).toContain('to: getProductById(card.id).routes.detail');
    expect(homeSource).not.toContain('to={slide.to || `/form/${slide.target}`}');
  });

  it('filters only replay promotions while preserving historical report replay', () => {
    expect(mySource).toContain(
      'replayPromoCandidates.filter((promo) => canDiscoverProduct(promo.productId))'
    );
    expect(mySource).toContain("productId: 'love-reunion'");
    expect(mySource).toContain("productId: 'match-couple'");
    expect(mySource).toContain("getProductById('love-reunion').routes.detail");
    expect(mySource).toContain("getProductById('match-couple').routes.detail");

    expect(mySource).toContain(
      'const visibleReports = showAllReports ? recentReports : recentReports.slice(0, 4);'
    );
    expect(mySource).toContain('{visibleReports.map((report) => (');
    expect(mySource).toContain('to={`/report/${report.productId}`}');
    expect(mySource).toContain('{recoverablePayments.map((entitlement) => {');
    expect(mySource).not.toContain('visibleReports.filter(');
    expect(mySource).not.toContain('recoverablePayments.filter(');
  });
});
