import { describe, expect, it } from 'vitest';
import { createMatchCoupleShareData } from './share';
import type { MatchCoupleReportModel } from './types';

describe('match-couple privacy-safe share', () => {
  it('shares the product page without private intake data', () => {
    const model = {
      overview: { tendency: 'conditional' },
      names: ['김본인', '이상대'],
      context: {
        majorConflict: '소비 습관',
        desiredInsight: '결혼 가능성',
        questions: ['비밀 질문 1', '비밀 질문 2']
      }
    } as MatchCoupleReportModel;
    const data = createMatchCoupleShareData(model, 'https://www.unwoldang.com/');

    expect(data.url).toBe('https://www.unwoldang.com/detail/match-couple');
    expect(JSON.stringify(data)).not.toContain('김본인');
    expect(JSON.stringify(data)).not.toContain('이상대');
    expect(JSON.stringify(data)).not.toContain('소비 습관');
    expect(JSON.stringify(data)).not.toContain('결혼 가능성');
    expect(JSON.stringify(data)).not.toContain('비밀 질문');
  });
});
