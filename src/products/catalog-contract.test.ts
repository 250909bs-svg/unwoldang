import { describe, expect, it } from 'vitest';
import { findServiceById, serviceIds } from '../api/mockData';
import { activeProducts, productRegistry } from './registry';
import { productIds } from './types';

function parseWonPrice(value: string) {
  return Number(value.replace(/[^0-9]/g, ''));
}

describe('product catalog compatibility', () => {
  it('keeps the legacy service ID tuple backed by canonical product IDs', () => {
    expect(serviceIds).toBe(productIds);
    expect(serviceIds).toHaveLength(12);
    expect(new Set(serviceIds).size).toBe(serviceIds.length);
  });

  it('preserves every existing product display name and price', () => {
    productIds.forEach((id) => {
      const service = findServiceById(id);
      const product = productRegistry[id];

      expect(product.displayName).toBe(service.label);
      expect(product.price).toBe(parseWonPrice(service.price));
      expect(product.currency).toBe('KRW');
    });
  });

  it('keeps the five active sale contracts unchanged', () => {
    expect(
      activeProducts.map(({ id, displayName, price }) => ({ id, displayName, price }))
    ).toEqual([
      { id: 'general-signature', displayName: '운월선생 정통 종합사주', price: 79_000 },
      { id: 'past-life-goblin', displayName: 'MZ 도깨비 전생사주', price: 49_000 },
      { id: 'love-reading', displayName: 'MZ무당 팩폭 연애운', price: 49_000 },
      { id: 'love-reunion', displayName: '홍연아씨 재회 가능성', price: 55_000 },
      { id: 'match-couple', displayName: '월연도령 사주궁합', price: 69_000 }
    ]);
  });
});
