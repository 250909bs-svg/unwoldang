import { describe, expect, it } from 'vitest';
import { celestialCoupleImage } from './media';
import { GUIYEONDO_RELATIONSHIP_VISUALS } from './relationshipVisuals';
import { GUIYEONDO_RELATIONSHIP_TYPES } from './types';

describe('귀연도 인연별 비주얼·설명 계약', () => {
  it('8개 인연에 서로 다른 이미지를 사용하고 천생연분 기존 이미지를 유지한다', () => {
    const images = GUIYEONDO_RELATIONSHIP_TYPES.map((type) => GUIYEONDO_RELATIONSHIP_VISUALS[type].image);

    expect(new Set(images).size).toBe(GUIYEONDO_RELATIONSHIP_TYPES.length);
    expect(GUIYEONDO_RELATIONSHIP_VISUALS.soulmate.image).toBe(celestialCoupleImage);
  });

  it('모든 인연에 상세 해석과 현실 확인 항목을 제공한다', () => {
    GUIYEONDO_RELATIONSHIP_TYPES.forEach((type) => {
      const visual = GUIYEONDO_RELATIONSHIP_VISUALS[type];
      expect(visual.interpretation.length).toBeGreaterThan(60);
      expect(visual.observations).toHaveLength(3);
      expect(visual.observations.every((item) => item.length >= 20)).toBe(true);
      expect(visual.focusVectors.length).toBeGreaterThanOrEqual(3);
      expect(visual.imageAlt.length).toBeGreaterThan(10);
    });
  });

  it('성장인연은 검증되지 않은 독립 점수를 암시하지 않는다', () => {
    const growth = GUIYEONDO_RELATIONSHIP_VISUALS['growth-relation'];
    expect(growth.description).toContain('현재 엔진');
    expect(growth.interpretation).not.toMatch(/확정|보장|점수|확률/);
  });
});
