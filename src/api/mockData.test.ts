import { describe, expect, it } from 'vitest';
import { findServiceById, serviceIds } from './mockData';

describe('MZ 도깨비 전생사주 상품', () => {
  it('상품 카탈로그와 공통 사주 흐름에 등록되어 있다', () => {
    const service = findServiceById('past-life-goblin');

    expect(serviceIds).toContain('past-life-goblin');
    expect(service.id).toBe('past-life-goblin');
    expect(service.label).toBe('MZ 도깨비 전생사주');
    expect(service.theme).toBe('pastlife');
    expect(service.price).toBe('49,000원');
    expect(service.output.join(' ')).toContain('다섯 권 26개');
    expect(service.output).toHaveLength(4);
  });

  it('기존 종합사주 상품과 별도 ID로 유지된다', () => {
    const generalService = findServiceById('general-signature');

    expect(generalService.id).toBe('general-signature');
    expect(generalService.label).toBe('운월선생 정통 종합사주');
    expect(generalService.theme).toBe('general');
  });
});
