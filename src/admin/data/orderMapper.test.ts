import { describe, expect, it } from 'vitest';
import type { ReportArchiveEntry } from '../../lib/reportArchive';
import { toAdminOrder } from './orderMapper';

function report(productId: string, title = '') {
  return {
    id: `archive-${productId}`,
    orderId: `order-${productId}`,
    productId,
    customerName: '테스트 고객',
    title,
    createdAt: '2026-07-20T00:00:00.000Z'
  } as unknown as ReportArchiveEntry;
}

describe('admin report order mapping', () => {
  it('keeps an archived product visible with its registry identity and price', () => {
    const order = toAdminOrder(report('life-flow'));
    expect(order).toMatchObject({
      productId: 'life-flow',
      productName: '운월선생 신년운세',
      productStatus: 'archived',
      amount: 59000,
      source: 'real',
      sourceChannel: '미수집',
      device: 'unknown',
      readRate: 0,
      reportLatencySec: 0,
      analyticsEstimated: false
    });
  });

  it('does not substitute an unknown product with general-signature', () => {
    const order = toAdminOrder(report('future-product', '미등록 리포트'));
    expect(order).toMatchObject({
      productId: 'future-product',
      productName: '미등록 리포트',
      productStatus: 'unknown',
      category: 'unknown',
      amount: 0
    });
    expect(order.productId).not.toBe('general-signature');
  });
});
