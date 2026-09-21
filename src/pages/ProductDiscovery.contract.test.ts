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

  it('derives local Home discovery and production Search collections from the registry', () => {
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

    expect(homeSource).toContain('const homeProductCards = discoverableProducts.map((product) => ({');
    expect(homeSource).toContain('...product.home');
    expect(homeSource).toContain('to: product.routes.detail');
    expect(searchSource).toContain(
      'const searchProducts: SearchProduct[] = discoverableProducts.map((product) => ({'
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
    /* 보관함 추천 카드는 상품 정의에서 파생된다. 예전에는 상품마다 제목·부제·이미지를
       손으로 다시 적어서, 정통사주가 카드 아트 대신 입력창 배경(intake-night-blue.png)을
       쓰고 상품 쪽 문구를 고쳐도 보관함만 옛 문구로 남았다.
       discoverableProducts 는 registry 에서 이미 canDiscoverProduct 로 걸러진 목록이다. */
    expect(mySource).toContain('const replayPromos: ReplayPromo[] = discoverableProducts.map(');
    expect(mySource).toContain('image: product.home.image');
    expect(mySource).toContain('to: product.routes.detail');
    // 상품 목록을 손으로 다시 적는 구조로 되돌아가면 잡는다.
    expect(mySource).not.toContain('replayPromoCandidates');
    expect(mySource).not.toContain("image: '/intake-");

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
