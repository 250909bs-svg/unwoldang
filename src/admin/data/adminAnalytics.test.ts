import { describe, expect, it } from 'vitest';
import {
  buildCategoryRows,
  buildChannelPerformanceRows,
  buildFunnel,
  buildProductRows,
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
