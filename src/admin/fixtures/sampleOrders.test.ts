import { describe, expect, it } from 'vitest';
import { buildSampleOrders } from './sampleOrders';

describe('admin sample order policy', () => {
  it('keeps archived product fixtures historical and never pending', () => {
    const referenceTime = Date.UTC(2026, 6, 22, 12);
    const archivedOrders = buildSampleOrders(referenceTime).filter((order) => order.productStatus === 'archived');

    expect(archivedOrders.length).toBeGreaterThan(0);
    expect(archivedOrders.every((order) => Date.parse(order.createdAt) <= referenceTime - 30 * 24 * 60 * 60 * 1000)).toBe(true);
    expect(archivedOrders.every((order) => order.status !== 'pending' && order.reportStatus !== 'generating')).toBe(true);
  });

  it('uses an active product for the current pending fixture', () => {
    const pendingOrder = buildSampleOrders(Date.UTC(2026, 6, 22, 12)).find((order) => order.status === 'pending');

    expect(pendingOrder).toMatchObject({
      productId: 'past-life-goblin',
      productStatus: 'active',
      reportStatus: 'generating'
    });
  });
});
