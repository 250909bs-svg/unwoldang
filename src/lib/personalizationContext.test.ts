import { describe, expect, it } from 'vitest';
import type { IntakeFormData } from '../api/mockData';
import {
  buildQuestionContext,
  buildRelationshipPersonalizationContext
} from './personalizationContext';

describe('personalization contexts', () => {
  it.each(['single', 'situationship', 'dating'] as const)(
    'creates four meaningfully different duration stages for %s',
    (status) => {
      const durations = ['under1', 'under3', 'under5', 'under10'] as const;
      const contexts = durations.map((duration) =>
        buildRelationshipPersonalizationContext({ relationshipStatus: status, relationshipDuration: duration })
      );

      expect(contexts.every(Boolean)).toBe(true);
      expect(new Set(contexts.map((item) => item?.stage)).size).toBe(4);
      expect(new Set(contexts.map((item) => item?.priorities.join('|'))).size).toBe(4);
      expect(new Set(contexts.map((item) => item?.actionGuides.join('|'))).size).toBe(4);
    }
  );

  it.each([
    ['사업을 시작해도 될까요?', 'business', 'pre-start'],
    ['사업 매출이 늘어도 돈이 남지 않는데 어떤 지출을 줄여야 하나요?', 'business_operation', 'operating-profitability'],
    ['회사에서 승진을 기다릴지 이직할지 고민입니다.', 'job_change', 'advancement-vs-move'],
    ['지금 만나는 사람과 결혼까지 가도 될까요?', 'marriage', 'considering-commitment'],
    ['썸을 오래 타고 있는데 상대가 관계를 정의하지 않아요.', 'dating', 'prolonged-ambiguity'],
    ['헤어진 사람에게 제가 먼저 연락해도 될까요?', 'reunion', 'post-breakup-contact']
  ])('preserves and classifies the actual situation: %s', (question, domain, stage) => {
    const context = buildQuestionContext(question);
    expect(context.originalQuestion).toBe(question);
    expect(context.domain).toBe(domain);
    expect(context.stage).toBe(stage);
    expect(context.currentSituation.length).toBeGreaterThan(10);
    expect(context.requestedDecision.length).toBeGreaterThan(5);
  });

  it('does not collapse business operation into pre-start business advice', () => {
    const preStart = buildQuestionContext('사업을 시작해도 될까요?');
    const operating = buildQuestionContext('사업 매출이 늘어도 돈이 남지 않는데 어떤 지출을 줄여야 하나요?');
    expect(preStart.domain).not.toBe(operating.domain);
    expect(preStart.stage).not.toBe(operating.stage);
    expect(operating.explicitConstraints).toContain('매출은 증가하고 있음');
    expect(operating.explicitConstraints).toContain('매출이 이익으로 남지 않음');
  });
});
