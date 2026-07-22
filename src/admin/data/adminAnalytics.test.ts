import { describe, expect, it } from 'vitest';
import { buildSampleOrders } from '../fixtures/sampleOrders';
import {
  buildCategoryRows,
  buildChannelPerformanceRows,
  buildFunnel,
  buildProductRows,
  buildRetentionCohorts,
  getLargestDrop
} from './adminAnalytics';

describe('admin empty analytics', () => {
  it('does not manufacture funnel traffic without records', () => {
    const funnel = buildFunnel([]);

    expect(funnel.every((step) => step.count === 0 && step.benchmark === 0)).toBe(true);
    expect(getLargestDrop(funnel)).toEqual({ label: '데이터 없음', drop: 0 });
  });

  it('does not manufacture views, sessions, spend, or product conversion without records', () => {
    expect(buildCategoryRows([]).every((row) => row.views === 0 && row.orders === 0)).toBe(true);
    expect(
      buildChannelPerformanceRows([]).every(
        (row) => row.sessions === 0 && row.estimatedSpend === 0 && row.orders === 0
      )
    ).toBe(true);
    expect(buildProductRows([]).every((row) => row.orders === 0 && row.conversion === 0)).toBe(true);
  });
});


describe('admin real-data analytics boundaries', () => {
  const realArchivedOrder = {
    ...buildSampleOrders(0).find((order) => order.productId === 'life-flow')!,
    source: 'real' as const,
    sourceChannel: '미수집' as const,
    device: 'unknown' as const,
    readRate: 0,
    reportLatencySec: 0,
    analyticsEstimated: false
  };

  it('does not manufacture production traffic, sessions, or ad spend', () => {
    const funnel = buildFunnel([realArchivedOrder]);
    expect(funnel.slice(0, 5).every((step) => step.count === 0)).toBe(true);
    expect(funnel.find((step) => step.key === 'payment_success')?.count).toBe(1);
    expect(buildCategoryRows([realArchivedOrder]).every((row) => row.views === 0)).toBe(true);
    expect(buildRetentionCohorts([])).toEqual([]);
    expect(buildChannelPerformanceRows([realArchivedOrder])).toEqual([
      expect.objectContaining({
        label: '미수집',
        sessions: 0,
        orders: 1,
        estimatedSpend: 0
      })
    ]);
  });

  it('keeps all registry statuses and archived historical revenue', () => {
    const rows = buildProductRows([realArchivedOrder]);
    expect(rows.filter((row) => row.status === 'active')).toHaveLength(5);
    expect(rows.filter((row) => row.status === 'archived')).toHaveLength(7);
    expect(rows.filter((row) => row.status === 'draft')).toHaveLength(0);
    expect(rows.find((row) => row.id === 'life-flow')).toMatchObject({
      status: 'archived',
      orders: 1,
      revenue: 59000,
      conversion: 0,
      avgReadRate: 0,
      analyticsAvailable: false
    });
  });
});
