import { describe, expect, it } from 'vitest';
import {
  PAST_LIFE_NARRATIVE_POLICY,
  PAST_LIFE_PRODUCT,
  PAST_LIFE_PRODUCT_ID,
  PAST_LIFE_REPORT_TOPIC_COUNT,
  PAST_LIFE_REPORT_VOLUMES,
  formatPastLifeReportTopic
} from './contract';
import { pastLifeGoblinProduct } from './index';

describe('past-life-goblin product contract', () => {
  it('keeps the contractual product identity and commercial display values', () => {
    expect(PAST_LIFE_PRODUCT_ID).toBe('past-life-goblin');
    expect(PAST_LIFE_PRODUCT.id).toBe(PAST_LIFE_PRODUCT_ID);
    expect(PAST_LIFE_PRODUCT.brand).toBe('MZ 도깨비 전생사주');
    expect(PAST_LIFE_PRODUCT.name).toBe('도깨비 전생장부: 봉인록');
    expect(PAST_LIFE_PRODUCT.price).toBe('49,000원');
  });

  it('stays aligned with the active product registry module', () => {
    expect(pastLifeGoblinProduct.id).toBe(PAST_LIFE_PRODUCT_ID);
    expect(pastLifeGoblinProduct.displayName).toBe(PAST_LIFE_PRODUCT.brand);
    expect(pastLifeGoblinProduct.price).toBe(49_000);
  });

  it('defines exactly five ordered volumes and 26 consecutive topics', () => {
    expect(PAST_LIFE_REPORT_VOLUMES.map((volume) => volume.id)).toEqual([
      'seal',
      'relationship',
      'karma',
      'present',
      'release'
    ]);
    expect(PAST_LIFE_REPORT_VOLUMES.map((volume) => volume.title)).toEqual([
      '봉인록',
      '인연록',
      '업록',
      '현생록',
      '해원록'
    ]);
    expect(PAST_LIFE_REPORT_VOLUMES.map((volume) => volume.topics.length)).toEqual([5, 4, 6, 5, 6]);
    expect(PAST_LIFE_REPORT_TOPIC_COUNT).toBe(26);

    const topicNumbers = PAST_LIFE_REPORT_VOLUMES.flatMap((volume) =>
      volume.topics.map((topic) => topic.number)
    );
    expect(topicNumbers).toEqual(Array.from({ length: 26 }, (_, index) => index + 1));
    expect(new Set(PAST_LIFE_REPORT_VOLUMES.map((volume) => volume.sectionId)).size).toBe(5);
  });

  it('formats a topic from the product contract and rejects unknown topics', () => {
    expect(formatPastLifeReportTopic(1)).toBe('01. 당신의 상징 봉인명');
    expect(formatPastLifeReportTopic(26)).toBe('26. 상징 인물이 현생의 나에게 보내는 편지');
    expect(() => formatPastLifeReportTopic(27)).toThrow('Unknown past-life report topic');
  });

  it('declares symbolic framing instead of factual past-life certainty', () => {
    expect(PAST_LIFE_NARRATIVE_POLICY.mode).toBe('symbolic-saju-narrative');
    expect(PAST_LIFE_NARRATIVE_POLICY.notice).toContain('상징 서사');
    expect(PAST_LIFE_NARRATIVE_POLICY.notice).toContain('증명하지 않습니다');
  });
});
