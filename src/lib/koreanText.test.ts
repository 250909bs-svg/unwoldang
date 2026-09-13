import { describe, expect, it } from 'vitest';
import { normalizeCustomerFacingText } from './koreanText';

describe('customer-facing Korean normalization', () => {
  it.each([
    ['관계의 역할 배치을 점검합니다.', '관계의 역할 배치를 점검합니다.'],
    ['판단 순서으로 정리합니다.', '판단 순서로 정리합니다.'],
    ['대운 진입 전 대운의 흐름입니다.', '첫 대운 진입 전의 흐름입니다.'],
    ['두 조건을 고려하면로 보이므로 확인합니다.', '두 조건을 고려하는 비교로 보이므로 확인합니다.']
  ])('repairs malformed paid-report wording: %s', (input, expected) => {
    expect(normalizeCustomerFacingText(input)).toBe(expected);
  });

  it.each([
    ['integration', '조화·결합 흐름'],
    ['activation', '활성화 흐름'],
    ['latent-tension', '잠재적 조정 필요']
  ])('maps internal tendency %s to customer Korean', (input, expected) => {
    expect(normalizeCustomerFacingText(input)).toBe(expected);
  });
});
