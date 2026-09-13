import { describe, expect, it } from 'vitest';
import { buildPremiumSajuPromptContext } from './premiumReportPrompt';

describe('premium saju prompt context', () => {
  it('passes relationship and question context without changing deterministic facts', () => {
    const deterministicBasis = { pillars: { day: '무자' } };
    const relationshipContext = { status: 'single', duration: 'under3' };
    const questionContexts = [{ originalQuestion: '사업 매출이 늘어도 돈이 남지 않아요.' }];
    const context = buildPremiumSajuPromptContext({
      customerInput: { name: '차민호' },
      deterministicBasis,
      relationshipContext,
      questionContexts
    });

    expect(context.deterministicBasis).toBe(deterministicBasis);
    expect(context.relationshipContext).toBe(relationshipContext);
    expect(context.questionContexts).toBe(questionContexts);
    expect(context.instructions.sourceOfTruth).toContain('deterministicBasis');
  });
});
