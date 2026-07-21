import { describe, expect, it } from 'vitest';
import { buildSampleOrders } from '../fixtures/sampleOrders';
import type { AdminOrder } from '../types/admin';
import { resolveAdminData } from './adminDataSource';

function buildRealOrder(): AdminOrder {
  return {
    ...buildSampleOrders(0)[0],
    id: 'real-record-1',
    orderId: 'UW-REAL-0001',
    source: 'real'
  };
}

describe('admin data source boundaries', () => {
  it('returns real records without merging fixtures even when fixtures are enabled', () => {
    const realOrder = buildRealOrder();
    const result = resolveAdminData([realOrder], { isDev: true, fixtureEnabled: true });

    expect(result).toEqual({ mode: 'real', orders: [realOrder] });
    expect(result.orders.every((order) => order.source === 'real')).toBe(true);
  });

  it('keeps production empty when a fixture flag is present', () => {
    expect(resolveAdminData([], { isDev: false, fixtureEnabled: true })).toEqual({
      mode: 'empty',
      orders: []
    });
  });

  it('keeps development empty until fixtures are explicitly enabled', () => {
    expect(resolveAdminData([], { isDev: true, fixtureEnabled: false })).toEqual({
      mode: 'empty',
      orders: []
    });
  });

  it('returns only sample records for an explicit development fixture session', () => {
    const result = resolveAdminData([], { isDev: true, fixtureEnabled: true });

    expect(result.mode).toBe('sample');
    expect(result.orders.length).toBeGreaterThan(0);
    expect(result.orders.every((order) => order.source === 'sample')).toBe(true);
  });
});
