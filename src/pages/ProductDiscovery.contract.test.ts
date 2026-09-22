import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { activeProducts, getProductById } from '../products/registry';

const homeSource = readFileSync(new URL('./Home.tsx', import.meta.url), 'utf8');
const menuSource = readFileSync(new URL('./Menu.tsx', import.meta.url), 'utf8');
const mySource = readFileSync(new URL('./My.tsx', import.meta.url), 'utf8');
/* 보관함은 마이가 메뉴 한 장이 되면서 `/my/reports` 로 옮겼다. 아래 계약의 대상은
   화면 이름이 아니라 "추천 카드를 손으로 다시 적지 않는다" 이므로, 파일만 따라간다. */
const myReportsSource = readFileSync(new URL('./MyReports.tsx', import.meta.url), 'utf8');
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
    expect(myReportsSource).toContain('const replayPromos: ReplayPromo[] = discoverableProducts.map(');
    expect(myReportsSource).toContain('image: product.home.image');
    expect(myReportsSource).toContain('to: product.routes.detail');
    // 상품 목록을 손으로 다시 적는 구조로 되돌아가면 잡는다.
    expect(myReportsSource).not.toContain('replayPromoCandidates');
    expect(myReportsSource).not.toContain("image: '/intake-");

    expect(myReportsSource).toContain(
      'const visibleReports = showAllReports ? recentReports : recentReports.slice(0, 4);'
    );
    expect(myReportsSource).toContain('{visibleReports.map((report) => (');
    expect(myReportsSource).toContain('to={`/report/${report.productId}`}');
    expect(myReportsSource).toContain('{recoverablePayments.map((entitlement) => {');
    expect(myReportsSource).not.toContain('visibleReports.filter(');
    expect(myReportsSource).not.toContain('recoverablePayments.filter(');
  });

  it('마이 메뉴의 바로가기 카드도 상품 아트를 레지스트리에서 가져온다', () => {
    /* 보관함에서 한 번 겪은 문제다. 카드마다 파일명을 다시 적으면 상품 아트를 바꿀 때
       이 화면만 옛 그림을 들고 있게 된다. 새로 만든 마이 메뉴에서 되풀이하지 않는다. */
    expect(mySource).toContain('const product = getProductById(card.id)');
    expect(mySource).toContain('src={product.home.image}');
    expect(mySource).not.toMatch(/image: '\/[\w-]+\.(png|jpg|webp)'/);
  });
});
