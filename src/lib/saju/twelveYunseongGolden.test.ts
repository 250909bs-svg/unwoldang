import { describe, expect, it } from 'vitest';
import { getTwelveYunseong } from './baziCalcs';
import { DZ, TG } from './constants';

const GOLDEN_BY_STEM = {
  갑: ['목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절', '태', '양', '장생'],
  을: ['병', '쇠', '제왕', '건록', '관대', '목욕', '장생', '양', '태', '절', '묘', '사'],
  병: ['태', '양', '장생', '목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절'],
  정: ['절', '묘', '사', '병', '쇠', '제왕', '건록', '관대', '목욕', '장생', '양', '태'],
  무: ['태', '양', '장생', '목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절'],
  기: ['절', '묘', '사', '병', '쇠', '제왕', '건록', '관대', '목욕', '장생', '양', '태'],
  경: ['사', '묘', '절', '태', '양', '장생', '목욕', '관대', '건록', '제왕', '쇠', '병'],
  신: ['장생', '양', '태', '절', '묘', '사', '병', '쇠', '제왕', '건록', '관대', '목욕'],
  임: ['제왕', '쇠', '병', '사', '묘', '절', '태', '양', '장생', '목욕', '관대', '건록'],
  계: ['건록', '관대', '목욕', '장생', '양', '태', '절', '묘', '사', '병', '쇠', '제왕']
} as const;

describe('12운성 independent golden table', () => {
  it('matches all 120 day-stem and branch combinations', () => {
    TG.forEach((stem, stemIndex) => {
      DZ.forEach((branch, branchIndex) => {
        expect(getTwelveYunseong(stemIndex, branchIndex), `${stem} 일간 × ${branch}`).toBe(
          GOLDEN_BY_STEM[stem][branchIndex]
        );
      });
    });
  });

  it('locks the launch sample 戊 day-master checkpoints', () => {
    const stem = TG.indexOf('무');
    expect(getTwelveYunseong(stem, DZ.indexOf('인'))).toBe('장생');
    expect(getTwelveYunseong(stem, DZ.indexOf('사'))).toBe('건록');
    expect(getTwelveYunseong(stem, DZ.indexOf('신'))).toBe('병');
    expect(getTwelveYunseong(stem, DZ.indexOf('유'))).toBe('사');
    expect(getTwelveYunseong(stem, DZ.indexOf('자'))).toBe('태');
  });
});
