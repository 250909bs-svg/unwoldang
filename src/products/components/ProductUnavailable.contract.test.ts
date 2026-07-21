import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it } from 'vitest';
import { productRegistry } from '../registry';
import ProductUnavailable from './ProductUnavailable';

describe('archived product unavailable screen', () => {
  it('shows the renovation notice and links to home and the report archive', () => {
    const product = productRegistry['life-flow'];
    const html = renderToStaticMarkup(
      createElement(
        StaticRouter,
        { location: product.routes.detail },
        createElement(ProductUnavailable, { product })
      )
    );

    expect(product.status).toBe('archived');
    expect(html).toContain('현재 개편 중인 상품입니다.');
    expect(html).toContain('기존 리포트 보관함으로 이동');
    expect(html).toContain('홈으로 이동');
    expect(html).toContain('href="/my"');
    expect(html).toContain('href="/"');
    expect(html).toContain('새로운 정보 입력과 결제를 받지 않습니다.');
  });
});
